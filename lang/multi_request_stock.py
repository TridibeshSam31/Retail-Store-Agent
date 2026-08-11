import os
import json
import pandas as pd
from typing import TypedDict, List
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

# We use the robust connection setup we built earlier to prevent Neon DB timeouts
engine = create_engine(
    os.getenv("DB_URL"),
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5
    }
)

llm = ChatGoogleGenerativeAI(model="gemini-3.5-flash-lite")

# ==========================================
# 1. THE STATE MEMORY
# ==========================================
class AgentState(TypedDict):
    """Memory of the current active negotiation."""
    deficit_store: str
    item_id: str
    required_eoq: int             # Fetched via SQL: How much the deficit store actually needs
    deficit_context: dict         # NEW: Holds the deficit store's current stock and demand
    surplus_stores: List[dict]    # UPDATED: Will now hold qty_on_hand, ROP, and demand
    current_responder_idx: int    # NEW: Tracks which store we are actively negotiating with
    negotiation_status: str       # NEW: "arguing", "agreed", "exhausted"
    messages: List[BaseMessage]   # Chat history between agents
    turn_count: int               # Tracks how many times agents have argued
    max_turns: int                # Config rule: Max turns before Arbitrator forces a split
    manager_decision: str         # Human-in-the-loop status ("pending", "approved", etc.)


def extract_text(response):
    if isinstance(response.content, list):
        return response.content[0].get('text', '')
    return response.content

# ==========================================
# 2. THE NODES (SQL & AGENTS)
# ==========================================

def detect_shortage(state: AgentState):
    """
    SQL Node: Finds the exact EOQ required, and dynamically queries the network 
    to find stores that have enough surplus, sorted by travel time.
    """
    deficit_store = state["deficit_store"]
    item_id = state["item_id"]
    
    with engine.connect() as conn:
        # 1. Fetch Deficit Context
        deficit_query = text("""
            SELECT ci.qty_on_hand, dp.rop, dp.eoq, dp.predicted_demand
            FROM current_inventory ci
            JOIN daily_predictions dp ON ci.store_id = dp.store_id AND ci.item_id = dp.item_id
            WHERE ci.store_id = :store AND ci.item_id = :item 
            AND dp.prediction_date = CURRENT_DATE - INTERVAL '1 day';
        """)
        d_result = conn.execute(deficit_query, {"store": deficit_store, "item": item_id}).fetchone()
        
        required_eoq = int(d_result[2]) if d_result else 0
        deficit_context = {
            "qty": int(d_result[0]), "rop": int(d_result[1]), "demand": int(d_result[3])
        } if d_result else {"qty": 0, "rop": 0, "demand": 0}
        
        # 2. Fetch Surplus Stores
        surplus_query = text("""
            SELECT ci.store_id as surplus_store_id, sd.est_hours, ci.qty_on_hand, dp.rop, dp.predicted_demand
            FROM current_inventory ci
            JOIN daily_predictions dp ON ci.store_id = dp.store_id AND ci.item_id = dp.item_id
            JOIN store_distances sd ON sd.store_id_a = :deficit_store AND sd.store_id_b = ci.store_id
            WHERE ci.item_id = :item AND dp.prediction_date = CURRENT_DATE - INTERVAL '1 day'
              AND ci.qty_on_hand >= (dp.rop + :required_eoq) AND ci.store_id != :deficit_store
            ORDER BY sd.est_hours ASC;
        """)
        
        surplus_df = pd.read_sql(
            surplus_query, conn, params={"deficit_store": deficit_store, "item": item_id, "required_eoq": required_eoq}
        )
        surplus_stores_list = surplus_df.to_dict(orient="records")
    
    return {
        "required_eoq": required_eoq,
        "deficit_context": deficit_context,
        "surplus_stores": surplus_stores_list,
        "current_responder_idx": 0,          # Start with the closest store
        "negotiation_status": "arguing"
    }

def initiator_agent(state: AgentState):
    """Store Agent (Deficit): Argues why it needs the stock right now."""
    store = state["deficit_store"]
    qty = state["required_eoq"]
    ctx = state["deficit_context"]
    target_store = state["surplus_stores"][state["current_responder_idx"]]["surplus_store_id"]
    
    prompt = f"""
    You are the manager of Store {store}. You urgently need {qty} units of item {state['item_id']} from Store {target_store}.
    Your metrics: Qty on Hand: {ctx['qty']}, ROP: {ctx['rop']}, Daily Demand: {ctx['demand']}
    Write a 1-sentence persuasive argument requesting the stock from Store {target_store} based on your metrics.
    """
    raw_response = llm.invoke([HumanMessage(content=prompt)])
    clean_text = extract_text(raw_response)
    
    return {
        "messages": state["messages"] + [AIMessage(content=f"Store {store} (Deficit): {clean_text}")],
        "turn_count": state["turn_count"] + 1
    }

def responder_agent(state: AgentState):
    # Looking at the top surplus store for this negotiation
    target_store = state["surplus_stores"][state["current_responder_idx"]]
    store_id = target_store["surplus_store_id"]
    
    my_qty = target_store["qty_on_hand"]
    my_rop = target_store["rop"]
    my_demand = target_store["predicted_demand"]
    requested_qty = state["required_eoq"]
    
    remaining_cushion = my_qty - requested_qty - my_rop
    history = "\n".join([m.content for m in state["messages"]])
    
    prompt = f"""
    Chat History:
    {history}
    
    You are the manager of Store {store_id}. Store {state['deficit_store']} wants {requested_qty} units of item {state['item_id']}.
    Your metrics: Qty on Hand: {my_qty}, ROP: {my_rop}, Daily Demand: {my_demand}.
    Cushion after transfer: {remaining_cushion} units above ROP.
    
    RULES:
    1. If your 'Cushion' is GREATER than your Daily Demand, you must agree. You MUST start your response with EXACTLY the word "[AGREED]" followed by a cheerful sentence confirming you can fulfill the full request.
    2. If your 'Cushion' is LESS than your Daily Demand, argue against it. Do NOT use the word [AGREED]. Write a 1-sentence refusal citing your metrics.
    """
    raw_response = llm.invoke([HumanMessage(content=prompt)])
    
    # FIX: Safely extract text string first so we can parse [AGREED] accurately
    clean_text = extract_text(raw_response)
    
    # Check if the model actually agreed
    status = "agreed" if "[AGREED]" in clean_text.upper() else "arguing"
    
    return {
        "messages": state["messages"] + [AIMessage(content=f"Store {store_id} (Surplus): {clean_text}")],
        "negotiation_status": status
    }

def next_store_transition(state: AgentState):
    """If a store refuses after max turns, this shifts the target to the next store."""
    next_idx = state["current_responder_idx"] + 1
    
    if next_idx >= len(state["surplus_stores"]):
        return {"negotiation_status": "exhausted"} # We asked everyone, nobody agreed.
    else:
        next_store_id = state["surplus_stores"][next_idx]["surplus_store_id"]
        return {
            "current_responder_idx": next_idx,
            "turn_count": 0, # Reset turns for the new 1-on-1 negotiation
            "messages": state["messages"] + [AIMessage(content=f"\n--- Moving negotiation to next optimal surplus location: Store {next_store_id} ---")]
        }

def arbitrator_agent(state: AgentState):
    """Neutral AI Judge: Reviews arguments and makes a final stock transfer proposal."""
    print("\n[ARBITRATOR AGENT] Reviewing arguments and making final decision...")
    
    deficit_store = state["deficit_store"]
    qty = state["required_eoq"]
    
    if state["negotiation_status"] == "agreed":
        # The ideal path: The current store agreed, lock it in!
        winning_store = state["surplus_stores"][state["current_responder_idx"]]["surplus_store_id"]
        decision = f"Agreement reached organically. Shift {qty} units from Store {winning_store} to Store {deficit_store}."
    else:
        # The exhausted path: Nobody agreed, force the N-way split
        num_surplus_stores = len(state["surplus_stores"])
        split_qty = qty // num_surplus_stores
        transfer_orders = [f"{split_qty} units from Store {s['surplus_store_id']}" for s in state["surplus_stores"]]
        order_text = ", and ".join(transfer_orders)
        decision = f"NEGOTIATIONS EXHAUSTED. Forcing an even split. Shift to Store {deficit_store}: {order_text}."

    return {
        "messages": state["messages"] + [AIMessage(content=f"Arbitrator Proposal: {decision}")],
        "manager_decision": "pending"
    }

def human_approval(state: AgentState):
    """Breakpoint Node: Execution stops here to wait for Manager UI input."""
    print("\n[SYSTEM] Paused. Awaiting Manager Approval on Arbitrator's Proposal...")
    return state

def escalate_to_supplier(state: AgentState):
    """Case D: Drafts a supplier order when no internal transfers are possible."""
    print("\n[SYSTEM] No viable transfers. Escalating to Supplier...")
    
    msg = f"wa.me/1234567890?text=Urgent%20Order%3A%20Store%20{state['deficit_store']}%20needs%20{state['required_eoq']}%20units%20of%20{state['item_id']}"
    return {"messages": state["messages"] + [AIMessage(content=f"System: Supplier escalation drafted. Link: {msg}")]}

# ==========================================
# 3. CONDITIONAL ROUTING LOGIC
# ==========================================

def route_after_detection(state: AgentState) -> str:
    """Decides the main flow (Case A, Case C, or Case D)."""
    if len(state["surplus_stores"]) == 0:
        return "escalate_to_supplier"
    else:
        return "initiator_agent" # Always start 1-on-1 negotiation if at least 1 store has stock

def route_after_responder(state: AgentState) -> str:
    """Loops negotiation until the max turn limit is reached."""
    if state["negotiation_status"] == "agreed":
        return "arbitrator_agent"  # <--- STOPS INSTANTLY AND LOCKS IN THIS STORE
    elif state["turn_count"] < state["max_turns"]:
        return "initiator_agent"   # Try one more turn with THIS store
    else:
        return "next_store_transition" # Max turns hit for this store with no agreement, move to next store

def route_after_transition(state: AgentState) -> str:
    if state["negotiation_status"] == "exhausted":
        return "arbitrator_agent" # Nobody agreed, time to force the split
    else:
        return "initiator_agent" # Start talking to the next store

def route_after_human(state: AgentState) -> str:
    """Case E: Routes based on what button the manager clicked."""
    if state["manager_decision"] == "approved": return END
    elif state["manager_decision"] == "renegotiate": return "initiator_agent"
    elif state["manager_decision"] == "escalate": return "escalate_to_supplier"
    return END

# ==========================================
# 4. COMPILE THE MULTI-AGENT GRAPH
# ==========================================
graph = StateGraph(AgentState)

graph.add_node("detect_shortage", detect_shortage)
graph.add_node("initiator_agent", initiator_agent)
graph.add_node("responder_agent", responder_agent)
graph.add_node("next_store_transition", next_store_transition)
graph.add_node("arbitrator_agent", arbitrator_agent)
graph.add_node("human_approval", human_approval)
graph.add_node("escalate_to_supplier", escalate_to_supplier)

graph.add_edge(START, "detect_shortage")
graph.add_conditional_edges("detect_shortage", route_after_detection)
graph.add_edge("initiator_agent", "responder_agent")
graph.add_conditional_edges("responder_agent", route_after_responder)

graph.add_conditional_edges("next_store_transition", route_after_transition)

graph.add_edge("arbitrator_agent", "human_approval")
graph.add_conditional_edges("human_approval", route_after_human)
graph.add_edge("escalate_to_supplier", END)

memory = MemorySaver()
# Compile with a human-in-the-loop breakpoint
app = graph.compile(
    checkpointer=memory,
    interrupt_before=["human_approval"]
    )

# ==========================================
# 5. EXECUTION BOOTSTRAP
# ==========================================
def main():
    print("=== STARTING THE DISPATCHER ===")
    
    # 1. Find all active deficits across the entire network
    # This replaces your old single-agent JSON generation
    deficits_query = text("""
        SELECT 
            ci.store_id, 
            ci.item_id 
        FROM current_inventory ci
        JOIN daily_predictions dp 
          ON ci.store_id = dp.store_id AND ci.item_id = dp.item_id
        WHERE dp.prediction_date = CURRENT_DATE - INTERVAL '1 day'
          AND ci.qty_on_hand < dp.rop;
    """)
    
    with engine.connect() as conn:
        all_deficits = pd.read_sql(deficits_query, conn)
    
    if all_deficits.empty:
        print("No inventory deficits detected today.")
    else:
        print(f"Detected {len(all_deficits)} individual item shortages. Launching negotiations...\n")
        
        # 2. Loop through each deficit and spawn a dedicated LangGraph negotiation
        for index, row in all_deficits.iterrows():
            d_store = str(row['store_id'])
            d_item = str(row['item_id'])
            
            print(f"--- STARTING THREAD FOR STORE {d_store} | ITEM {d_item} ---")
            
            # Dynamically generate the initial state for THIS specific shortage
            initial_state = {
                "deficit_store": d_store,
                "item_id": d_item,
                "required_eoq": 0,    # Will be populated by detect_shortage
                "surplus_stores": [], # Will be populated by detect_shortage
                "messages": [],
                "turn_count": 0,
                "max_turns":2,  
                "manager_decision": "pending"
            }

            # Create a unique thread ID so LangGraph keeps the memories separate
            thread_id = f"negotiation_store{d_store}_item{d_item}"
            config = {"configurable": {"thread_id": thread_id}}

            # 3. Run the graph until it hits the Human Approval breakpoint
            for event in app.stream(initial_state, config=config, stream_mode="values"):
                pass 
            
            # 4. Display the results for the Manager
            current_state = app.get_state(config).values
            
            # If the graph routed straight to the supplier (Case D), skip approval
            if len(current_state["surplus_stores"]) == 0:
                print(f"[SYSTEM] No surplus found for item {d_item}. Escalated to supplier automatically.\n")
                continue
                
            print(f"\n[NEGOTIATION LOG FOR ITEM {d_item}]")
            for m in current_state["messages"]:
                print(m.content)

            print(f"\n[MANAGER UI] Simulating human approval for Store {d_store}...")
            
            # 5. Inject the human decision and finish the graph
            app.update_state(config, {"manager_decision": "approved"})
            
            for event in app.stream(None, config=config, stream_mode="values"):
                pass
            
            print(f"--- FINISHED THREAD FOR STORE {d_store} | ITEM {d_item} ---\n")

main()  