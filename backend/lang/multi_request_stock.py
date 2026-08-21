"""
LangGraph negotiation engine. Lives at backend/lang, sibling to
backend/app - imports app.models/app.core.db directly since Agents
and Backend run in the same process.

Entry points Backend calls (see bridge.py):
  - run_negotiation(negotiation_id) — called right after Backend
    commits a new Negotiation row (from trigger_service.py, via the
    router, post-commit — see note in inventory.py/transactions.py).
  - resume_negotiation(negotiation_id, decision) — called from
    negotiations.py's approve/reject routes.

Every LLM turn, the final resolution, and resulting transfers are
written straight to Postgres via app.models — nothing lives only in
LangGraph's in-memory checkpoint except routing state.
"""
import sys
from pathlib import Path
from typing import TypedDict, List, Optional
from urllib.parse import quote
from dotenv import load_dotenv
load_dotenv()
from psycopg_pool import ConnectionPool
from langgraph.checkpoint.postgres import PostgresSaver
import os

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import langchain
if not hasattr(langchain, "verbose"):
    langchain.verbose = False
if not hasattr(langchain, "debug"):
    langchain.debug = False

from sqlalchemy import text
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage,SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

from app.core.db import SessionLocal, engine
from app.models import (
    Negotiation, NegotiationTurn, Transfer, Config, Store, Supplier,
    CurrentInventory,
)
from langgraph.prebuilt import ToolNode
from lang.tools.inventory_tools import ALL_TOOLS, get_safe_surplus
from pydantic import BaseModel, Field
from typing import Annotated
from langgraph.graph.message import add_messages
from app.services.prediction_service import get_usable_surplus

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")


def extract_text(response):
    if isinstance(response.content, list):
        return response.content[0].get("text", "")
    return response.content


# ==========================================
# STATE
# ==========================================
class AgentDecision(BaseModel):
    decision: str = Field(description="Must be exactly: ACCEPT, COUNTER, or REFUSE")
    quantity: int = Field(description="The final number of units to transfer (0 if REFUSE).")
    reason: str = Field(description="Business justification based on tool data.")

class AgentState(TypedDict):
    negotiation_id: int
    deficit_store: str
    item_id: str
    required_eoq: int
    remaining_needed: int
    deficit_context: dict
    surplus_stores: List[dict]
    allocations: List[dict]
    current_responder_idx: int
    negotiation_status: str
    messages: Annotated[list, add_messages]
    turn_count: int
    max_turns: int
    manager_decision: str


def _persist_turn(negotiation_id: int, store_id: int, turn_number: int, text_content: str):
    db = SessionLocal()
    try:
        db.add(NegotiationTurn(
            negotiation_id=negotiation_id, store_id=store_id,
            turn_number=turn_number, argument_text=text_content, responded=True,
        ))
        db.commit()
        print(f"[_persist_turn] wrote turn {turn_number} for negotiation {negotiation_id}")
    except Exception as e:
        print(f"[_persist_turn] FAILED for negotiation {negotiation_id}: {e}")
        raise
    finally:
        db.close()


# ==========================================
# NODES
# ==========================================
def detect_shortage(state: AgentState):
    negotiation_id = state["negotiation_id"]    
    db = SessionLocal()
    try:
        neg = db.get(Negotiation, negotiation_id)
        deficit_store = neg.initiator_store_id
        item_id = neg.item_id
        org_id = neg.org_id

        d_result = db.execute(text("""
            SELECT ci.qty_on_hand, dp.rop, dp.eoq, dp.predicted_demand
            FROM current_inventory ci
            JOIN daily_predictions dp ON ci.store_id = dp.store_id AND ci.item_id = dp.item_id
            WHERE ci.store_id = :store AND ci.item_id = :item
            ORDER BY dp.prediction_date DESC LIMIT 1
        """), {"store": deficit_store, "item": item_id}).fetchone()

        required_eoq = int(d_result[2]) if d_result else 0
        deficit_context = (
            {"qty": int(d_result[0]), "rop": int(d_result[1]), "demand": float(d_result[3])}
            if d_result else {"qty": 0, "rop": 0, "demand": 0}
        )

        # Candidate stores: same org, has a distance entry from the deficit store,
        # sorted nearest first. usable_surplus computed via the shared, tested
        # service function (correctly excludes near-expiry stock).
        candidates = db.execute(text("""
            SELECT ci.store_id, sd.est_hours
            FROM current_inventory ci
            JOIN store_distances sd ON sd.store_id_a = :deficit_store AND sd.store_id_b = ci.store_id
            JOIN stores s ON ci.store_id = s.store_id
            WHERE ci.item_id = :item AND ci.store_id != :deficit_store AND s.org_id = :org_id
            ORDER BY sd.est_hours ASC
        """), {"deficit_store": deficit_store, "item": item_id,"org_id": org_id}).fetchall()

        surplus_stores_list = []
        for store_id, est_hours in candidates:
            surplus = get_usable_surplus(db, store_id, item_id)
            if surplus > 0:
                surplus_stores_list.append({
                    "surplus_store_id": store_id, "est_hours": float(est_hours),
                    "usable_surplus": surplus,
                })
    finally:
        db.close()

    return {
        "deficit_store": str(deficit_store),
        "item_id": str(item_id),
        "required_eoq": required_eoq,   
        "remaining_needed": required_eoq,
        "deficit_context": deficit_context,
        "surplus_stores": surplus_stores_list,
        "allocations": [],
        "current_responder_idx": 0,
        "negotiation_status": "arguing",
    }


def initiator_agent(state: AgentState):
    store = state["deficit_store"]
    needed = state["remaining_needed"]
    target_store = state["surplus_stores"][state["current_responder_idx"]]["surplus_store_id"]

    prompt = f"""
    You are the manager of Store {store}. You still need {needed} units of item {state['item_id']} to completely resolve your shortage.
    You are negotiating with Store {target_store} to request a contribution from their surplus.
    Write a 1-sentence persuasive argument requesting the stock.
    """
    raw_response = llm.invoke([HumanMessage(content=prompt)])
    clean_text = extract_text(raw_response)
    turn_number = state["turn_count"] + 1

    _persist_turn(state["negotiation_id"], int(store), turn_number, clean_text)

    return {"messages": [AIMessage(content=f"Store {store} (Deficit): {clean_text}")], "turn_count": turn_number}


def responder_agent(state: AgentState):
    llm_with_tools = llm.bind_tools(ALL_TOOLS + [AgentDecision])
    
    prompt = f"""You are the inventory agent for Store {state['surplus_stores'][state['current_responder_idx']]['surplus_store_id']}.
    Store {state['deficit_store']} is requesting {state['remaining_needed']} units of item {state['item_id']}.
    
    CRITICAL INSTRUCTIONS:
    1. You must use 'get_safe_surplus' to determine what you can safely give.
    2. You must use 'get_transfer_eta' to ensure the transfer time is reasonable.
    3. If safe_surplus >= requested, ACCEPT the full amount.
    4. If safe_surplus < requested but > 0, COUNTER with the safe_surplus amount.
    5. If safe_surplus == 0, REFUSE the transfer.
    6. When you are ready to make your final decision, use the AgentDecision tool.
    """
    
    response = llm_with_tools.invoke([SystemMessage(content=prompt)] + state["messages"])
    
    return {"messages": [response]}

def hard_validator(state: AgentState):
    """Validates the LLM's final decision against raw database truth."""
    last_message = state["messages"][-1]
    
    # If the LLM just called a standard inventory tool, pass it back to the tools node
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        # Check if the tool called was the final decision
        if last_message.tool_calls[0]['name'] != "AgentDecision":
            return state
            
    try:
        # Extract proposed quantity from the AgentDecision tool call
        decision_data = last_message.tool_calls[0]['args'] 
        proposed_qty = decision_data.get("quantity", 0)
        
        curr_store_id = state['surplus_stores'][state['current_responder_idx']]['surplus_store_id']
        
        # Python securely double-checks the math using the tool directly
        actual_safe_surplus = get_safe_surplus.invoke({"store_id": curr_store_id, "item_id": int(state['item_id'])})['safe_surplus']
        
        if proposed_qty > actual_safe_surplus:
            # Math hallucination detected! Reject it.
            rejection_msg = SystemMessage(content=f"HARD REJECT: You proposed {proposed_qty}, but your actual safe surplus is {actual_safe_surplus}. Propose a valid quantity.")
            return {"messages": [rejection_msg], "negotiation_status": "validation_failed"}
            
        # It passed validation! Update status and append to allocations if agreed
        status = "store_agreed" if proposed_qty > 0 else "refused"
        allocations = state.get("allocations", [])
        
        if status == "store_agreed":
            allocations.append({"surplus_store_id": curr_store_id, "qty": proposed_qty})
            
        return {"messages": [], "negotiation_status": status, "allocations": allocations}
        
    except Exception as e:
        # If the LLM outputs garbage text instead of JSON, force it to try again
        return {"messages": [SystemMessage(content="Format error. You must output a valid AgentDecision.")], "negotiation_status": "validation_failed"}

def next_store_transition(state: AgentState):
    next_idx = state["current_responder_idx"] + 1
    if next_idx >= len(state["surplus_stores"]):
        return {"negotiation_status": "exhausted"}
    next_store_id = state["surplus_stores"][next_idx]["surplus_store_id"]
    return {"current_responder_idx": next_idx, "turn_count": 0, "messages": [AIMessage(content=f"\n--- Moving to next store: {next_store_id} ---")]}


def process_agreement_or_transition(state: AgentState):
    status = state["negotiation_status"]
    curr_idx = state["current_responder_idx"]
    target_store = state["surplus_stores"][curr_idx]
    store_id = target_store["surplus_store_id"]

    messages = list(state["messages"])
    allocations = list(state["allocations"])
    remaining_needed = state["remaining_needed"]

    if status == "store_agreed":
        pledge_qty = min(remaining_needed, int(target_store["usable_surplus"]))
        allocations.append({"surplus_store_id": store_id, "qty": pledge_qty})
        remaining_needed -= pledge_qty
        return {
            "allocations": allocations, 
            "remaining_needed": remaining_needed,
            "messages": [AIMessage(content=f"[SYSTEM] Store {store_id} contributed {pledge_qty}. Remaining: {remaining_needed}.")]
        }
    if remaining_needed > 0 and (curr_idx + 1) < len(state["surplus_stores"]):
        next_idx = curr_idx + 1
        return {
            "allocations": allocations, "remaining_needed": remaining_needed,
            "current_responder_idx": next_idx, "turn_count": 0,
            "negotiation_status": "arguing", "messages": messages,
        }

    final_status = "fully_satisfied" if remaining_needed == 0 else "partial_satisfied"
    return {
        "allocations": allocations, "remaining_needed": remaining_needed,
        "negotiation_status": final_status, "messages": messages,
    }


def arbitrator_agent(state: AgentState):
    negotiation_id = state["negotiation_id"]
    deficit_store = int(state["deficit_store"])
    item_id = int(state["item_id"])
    allocations = state["allocations"]

    db = SessionLocal()
    try:
        neg = db.get(Negotiation, negotiation_id)

        if len(allocations) == 0:
            decision = "No surplus available across any store in the network. Escalating to supplier."
            neg.resolution_type = "supplier"
            neg.status = "proposed"  # escalate_to_supplier node finalizes this
        else:
            # "partial" is used for BOTH the max-turns even-split fallback AND
            # a partial fill (allocations that don't fully cover required_eoq)
            # — per your call, both share the same resolution_type value.
            fully_covered = state["remaining_needed"] == 0
            neg.resolution_type = "transfer" if fully_covered else "partial"
            neg.status = "proposed"  # awaits manager approval

            for alloc in allocations:
                db.add(Transfer(
                    negotiation_id=negotiation_id,
                    from_store_id=alloc["surplus_store_id"],
                    to_store_id=deficit_store,
                    item_id=item_id,
                    qty=alloc["qty"],
                ))

            transfer_summaries = [f"{a['qty']} units from Store {a['surplus_store_id']}" for a in allocations]
            order_text = ", and ".join(transfer_summaries)
            decision = (
                f"Full allocation achieved. Shift to Store {deficit_store}: {order_text}."
                if fully_covered else
                f"Partial fill (network surplus exhausted). Shift to Store {deficit_store}: {order_text}."
            )

        db.commit()
    finally:
        db.close()

    return {"messages": [AIMessage(content=f"Arbitrator Proposal: {decision}")], "manager_decision": "pending"}


def human_approval(state: AgentState):
    return state  # real pause happens via interrupt_before; resumed by bridge.resume_negotiation


def escalate_to_supplier(state: AgentState):
    negotiation_id = state["negotiation_id"]
    deficit_store = int(state["deficit_store"])
    item_id = int(state["item_id"])

    db = SessionLocal()
    try:
        supplier = db.query(Supplier).filter(
            Supplier.store_id == deficit_store, Supplier.item_id == item_id
        ).first()
        if not supplier:
            link_summary = "No supplier on file — manual 'Contact Supplier' instruction shown to manager."
        else:
            message = (
                f"Hi {supplier.name}, we need to reorder item #{item_id} for store #{deficit_store}. "
                f"Please advise availability and lead time."
            )
            if supplier.pref == "whatsapp" and supplier.phone:
                link_summary = f"wa.me/{supplier.phone}?text={quote(message)}"
            elif supplier.email:
                link_summary = f"mailto:{supplier.email}?subject=Reorder&body={quote(message)}"
            else:
                link_summary = "No channel on file — plain instruction shown."

        neg = db.get(Negotiation, negotiation_id)
        neg.resolution_type = "supplier"
        neg.status = "proposed"
        db.commit()
    finally:
        db.close()

    return {"messages": [AIMessage(content=f"System: Supplier escalation drafted. {link_summary}")]}


# ==========================================
# ROUTING
# ==========================================
def route_after_detection(state: AgentState) -> str:
    return "escalate_to_supplier" if len(state["surplus_stores"]) == 0 else "initiator_agent"


def route_after_responder(state: AgentState) -> str:
    if state["negotiation_status"] == "store_agreed":
        return "process_agreement_or_transition"
    elif state["turn_count"] < state["max_turns"]:
        return "initiator_agent"
    return "process_agreement_or_transition"


def route_after_processing(state: AgentState) -> str:
    return "initiator_agent" if state["negotiation_status"] == "arguing" else "arbitrator_agent"


def route_after_human(state: AgentState) -> str:
    decision = state["manager_decision"]
    if decision == "approved":
        return END
    elif decision == "renegotiate":
        return "initiator_agent"
    elif decision == "escalate":
        return "escalate_to_supplier"
    return END

def route_responder_output(state: AgentState) -> str:
    """Checks whether the responder called a tool or made a final decision."""
    last_message = state["messages"][-1]
    
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        # If the LLM is outputting its final decision via the Pydantic schema
        if last_message.tool_calls[0]["name"] == "AgentDecision":
            return "hard_validator"
        # Otherwise, it's a real tool (like get_safe_surplus), so execute it
        return "tools"
        
    # If it outputs plain text by mistake, send to validator to get rejected
    return "hard_validator"


def route_after_validator(state: AgentState) -> str:
    """If hard validation fails, re-prompt responder. If valid, proceed with standard flow."""
    # If validator marked status as 'validation_failed', force responder to try again
    if state.get("negotiation_status") == "validation_failed":
        return "responder_agent"
    
    # If validation passed, use your existing responder routing logic!
    return route_after_responder(state)


tool_node = ToolNode(ALL_TOOLS)

# ==========================================
# GRAPH
# ==========================================
graph = StateGraph(AgentState)
graph.add_node("detect_shortage", detect_shortage)
graph.add_node("initiator_agent", initiator_agent)
graph.add_node("responder_agent", responder_agent)
graph.add_node("tools", tool_node)                    
graph.add_node("hard_validator", hard_validator)
graph.add_node("process_agreement_or_transition", process_agreement_or_transition)
graph.add_node("arbitrator_agent", arbitrator_agent)
graph.add_node("human_approval", human_approval)
graph.add_node("escalate_to_supplier", escalate_to_supplier)

graph.add_edge(START, "detect_shortage")
graph.add_conditional_edges("detect_shortage", route_after_detection)
graph.add_edge("initiator_agent", "responder_agent")
graph.add_conditional_edges("responder_agent", route_responder_output)
graph.add_edge("tools", "responder_agent")
graph.add_conditional_edges("hard_validator", route_after_validator)
graph.add_conditional_edges("process_agreement_or_transition", route_after_processing)
graph.add_edge("arbitrator_agent", "human_approval")
graph.add_conditional_edges("human_approval", route_after_human)
graph.add_edge("escalate_to_supplier", END)

pg_uri = os.getenv("DB_URL").replace("+psycopg2", "")

# 2. Initialize a connection pool for LangGraph
connection_pool = ConnectionPool(
    conninfo=pg_uri,
    max_size=20,
    kwargs={"autocommit": True}
)

# 3. Create the PostgresSaver using the pool
memory = PostgresSaver(connection_pool)

# 4. Auto-create LangGraph's internal checkpoint tables if they don't exist yet
memory.setup()

negotiation_app = graph.compile(checkpointer=memory, interrupt_before=["human_approval"])


# ==========================================
# ENTRY POINTS (called from bridge.py)
# ==========================================
def _thread_config(negotiation_id: int) -> dict:
    return {"configurable": {"thread_id": f"negotiation_{negotiation_id}"}}


def run_negotiation(negotiation_id: int) -> None:
    """Called once, right after Backend commits a new Negotiation row."""
    db = SessionLocal()
    try:
        neg = db.get(Negotiation, negotiation_id)
        cfg = db.get(Config, neg.org_id)
        max_turns = cfg.max_negotiation_turns if cfg else 2
    finally:
        db.close()

    initial_state = {
        "negotiation_id": negotiation_id,
        "deficit_store": "", "item_id": "", "required_eoq": 0, "remaining_needed": 0,
        "deficit_context": {}, "surplus_stores": [], "allocations": [],
        "current_responder_idx": 0, "negotiation_status": "arguing",
        "messages": [], "turn_count": 0, "max_turns": max_turns,
        "manager_decision": "pending",
    }
    for _ in negotiation_app.stream(initial_state, config=_thread_config(negotiation_id), stream_mode="values"):
        pass


def resume_negotiation(negotiation_id: int, decision: str) -> None:
    """Called from Backend's approve/reject routes. decision: approved | renegotiate | escalate"""
    config = _thread_config(negotiation_id)
    negotiation_app.update_state(config, {"manager_decision": decision})
    for _ in negotiation_app.stream(None, config=config, stream_mode="values"):
        pass


