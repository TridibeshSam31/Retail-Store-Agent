from langgraph.graph import StateGraph, START, END
from langchain_google_genai import ChatGoogleGenerativeAI
import langchain
if not hasattr(langchain, "verbose"):
    langchain.verbose = False
from langchain_core.messages import HumanMessage, SystemMessage
from typing import TypedDict, List, Dict
import pandas as pd
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv
import json

load_dotenv()
engine = create_engine(os.getenv("DB_URL"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

llm = ChatGoogleGenerativeAI(
        model="gemini-3.5-flash-lite",
        temperature=1.0,
        max_tokens=None,
        timeout=None,
        max_retries=2,
    )

class State(TypedDict):
    """Memory of entire pipeline"""
    prompt : HumanMessage
    instructions : SystemMessage
    deficency : Dict
    store_distance_map : Dict
    json_output : str 
    final_plan : str

def add_data(state:State):
    """Adds all data inside the memory"""
    #1. Selecting deficency of items of store
    query = """
        SELECT 
            ci.store_id, 
            ci.item_id 
        FROM current_inventory ci
        JOIN daily_predictions dp 
          ON ci.store_id = dp.store_id 
         AND ci.item_id = dp.item_id
        WHERE dp.prediction_date = CURRENT_DATE - INTERVAL '1 day'
          AND ci.qty_on_hand < dp.rop;
    """
    df = pd.read_sql(query, engine)
    df['store_id'] = df['store_id'].astype(str)
    df['item_id'] = df['item_id'].astype(str)
    deficit_dict = df.groupby('store_id')['item_id'].apply(list).to_dict()
    state["deficency"] = deficit_dict

    #2. Selecting surplus store and there distance
    query_all_stores = "SELECT DISTINCT store_id FROM stores;"
    df_all = pd.read_sql(query_all_stores, engine)

    all_stores = df_all['store_id'].astype(str).tolist()
    query_deficits = """
        SELECT 
            ci.store_id, 
            ci.item_id 
        FROM current_inventory ci
        JOIN daily_predictions dp 
        ON ci.store_id = dp.store_id 
        AND ci.item_id = dp.item_id
        WHERE dp.prediction_date = CURRENT_DATE - INTERVAL '1 day'
        AND ci.qty_on_hand < dp.rop;
    """
    df_deficit = pd.read_sql(query_deficits, engine)

    df_deficit['store_id'] = df_deficit['store_id'].astype(str)
    df_deficit['item_id'] = df_deficit['item_id'].astype(str)

    # Map the deficits cleanly: { "store_id": ["item_1", "item_2"] }
    deficit_inventory = df_deficit.groupby('store_id')['item_id'].apply(list).to_dict()
    deficit_stores = list(deficit_inventory.keys())
    query_dist = "SELECT store_id_a, store_id_b, est_hours FROM store_distances;"
    df_dist = pd.read_sql(query_dist, engine)

    df_dist['store_id_a'] = df_dist['store_id_a'].astype(str)
    df_dist['store_id_b'] = df_dist['store_id_b'].astype(str)

    store_distance_map = {}

    for def_store in deficit_stores:
        store_distance_map[def_store] = {}
        
        for other_store in all_stores:
            if other_store == def_store:
                continue
                
            match = df_dist[
                (df_dist['store_id_a'] == def_store) & 
                (df_dist['store_id_b'] == other_store)
            ]
            
            if not match.empty:
                est_time = float(match['est_hours'].iloc[0])
                store_distance_map[def_store][other_store] = est_time
            else:
                store_distance_map[def_store][other_store] = float('inf')

    state["store_distance_map"] = store_distance_map
    
    return state

def get_response(state:State):
    """Getting response of LLM fo what woudl be the best case for shifting in json (right now single agent only)"""
    input = f"""
    Prompt = {state["prompt"].content}
    System Instruction = {state["instructions"].content}
    Deficiency Dictionary = {state["deficency"]}
    Store Distance Map = {state["store_distance_map"]}
    """
    response = llm.invoke(input=input)
    print("LLM is thinking.......")
    from rich.console import Console
    if isinstance(response.content, list):
        raw_text = response.content[0].get('text', '')
    else:
        raw_text = response.content
        
    # Clean up any accidental markdown tags the LLM might hallucinate
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()
    # print(raw_text)
    
    try:
        # Parse the JSON string into a Python dictionary
        routing_data = json.loads(raw_text)
        
        # Save the structured data back to the state for the next node to use
        state["routing_plan"] = routing_data
        
        # Pretty-print the JSON to the terminal
        console = Console()
        console.print_json(data=routing_data)
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON. LLM Output: {raw_text}")
        print(f"Error: {e}")
    # print(response.content)   
    state["json_output"] = raw_text
    return state

def check_stock(state:State):
    """Checking if the stock is enough"""
    print("Verifying inventory levels and executing transfers...")
    
    try:
        routing_plan = json.loads(state["json_output"])
    except json.JSONDecodeError:
        print("Error: Invalid JSON received from previous node.")
        return state

    # --- CHANGED START: Added dp.eoq to the SQL Query ---
    query = """
        SELECT 
            ci.store_id, 
            ci.item_id, 
            ci.qty_on_hand, 
            dp.rop,
            dp.eoq
        FROM current_inventory ci
        JOIN daily_predictions dp 
          ON ci.store_id = dp.store_id 
         AND ci.item_id = dp.item_id
        WHERE dp.prediction_date = CURRENT_DATE - INTERVAL '1 day';
    """
    # --- CHANGED END ---
    df_inv = pd.read_sql(query, engine)
    
    df_inv['store_id'] = df_inv['store_id'].astype(str)
    df_inv['item_id'] = df_inv['item_id'].astype(str)

    def get_stock_data(store, item):
        row = df_inv[(df_inv['store_id'] == store) & (df_inv['item_id'] == item)]
        if row.empty:
            # --- CHANGED START: Include eoq in the fallback dictionary ---
            return {'qty': 0, 'rop': 0, 'eoq': 0}
            
        return {
            'qty': int(row['qty_on_hand'].iloc[0]), 
            'rop': int(row['rop'].iloc[0]),
            'eoq': int(row['eoq'].iloc[0])
        }
        # --- CHANGED END ---

    verification_log = []
    
    for deficit_node in routing_plan:
        d_store = deficit_node["deficit_store_id"]
        items = deficit_node["deficient_items"]
        ranked_sources = deficit_node["ranked_surplus_sources"]
        
        verification_log.append(f"\n--- EVALUATING DEFICIT STORE {d_store} ---")
        
        for item in items:
            inv = get_stock_data(d_store, item)
            
            # --- CHANGED START: Target EOQ instead of just the ROP shortfall ---
            # If the item is no longer deficient (e.g. background update), skip it
            if inv['qty'] >= inv['rop']:
                continue 
                
            target_eoq = inv['eoq']
            if target_eoq == 0:
                continue # Safety guard
                
            verification_log.append(f"Item {item} at Store {d_store} requires its EOQ of {target_eoq} units.")
            # --- CHANGED END ---
            
            for source in ranked_sources:
                s_store = source["surplus_store_id"]
                s_inv = get_stock_data(s_store, item)
                
                # Surplus is strictly what is ABOVE the source store's own ROP
                surplus_available = max(0, s_inv['qty'] - s_inv['rop'])
                
                verification_log.append(
                    f"  -> Source Store {s_store} (Travel: {source['travel_time_hours']}h) "
                    f"has {surplus_available} units of surplus available."
                )

    log_text = "\n".join(verification_log)
    
    llm_prompt = f"""
    You are an automated Logistics Execution AI. 
    
    Below is an Inventory Verification Log. It details the Economic Order Quantity (EOQ) that each deficit store requires, 
    and how much excess surplus is available at their backup stores (ranked by distance).
    
    Your task is to officially assign the stock transfers. 
    
    RULES:
    1. For each item a deficit store needs, note its required EOQ.
    2. Evaluate the ranked source stores in order.
    3. Select the FIRST (highest ranked) source store that has a surplus quantity GREATER THAN OR EQUAL TO the required EOQ. 
       (The source store must be able to fulfill the entire EOQ without its own inventory dropping below its ROP).
    4. If the top store does not have enough surplus to cover the entire EOQ, move down the list to the next store. 
    
    OUTPUT FORMAT:
    You MUST output your response STRICTLY as a valid JSON object. Do not include any conversational text, explanations, or markdown code blocks (like ```json).
    
    Your JSON must perfectly match this schema. Use "SHIFT_STARTED" if a source is found, and "NO_SHIFT_POSSIBLE" if no store has enough surplus. If no shift is possible, set surplus_store_id to null and quantity to 0.
    
    {{
      "transactions": [
        {{
          "deficit_store_id": "string",
          "item_id": "string",
          "status": "SHIFT_STARTED",
          "surplus_store_id": "string",
          "quantity": 150
        }},
        {{
          "deficit_store_id": "string",
          "item_id": "string",
          "status": "NO_SHIFT_POSSIBLE",
          "surplus_store_id": null,
          "quantity": 0
        }}
      ]
    }}
    
    Inventory Verification Log:
    {log_text}
    """    
    response = llm.invoke(llm_prompt)
    
    if isinstance(response.content, list):
        raw_text = response.content[0].get('text', '')
    else:
        raw_text = response.content
        
    # 2. Now it is safe to clean up the markdown formatting
    raw_text = raw_text.replace("```json", "").replace("```", "").strip()
    
    try:
        execution_plan = json.loads(raw_text)
        state["final_plan"] = execution_plan
        
        print("\n=== FINAL TRANSFER EXECUTION PLAN ===")
        print(json.dumps(execution_plan, indent=2))
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON execution plan. Error: {e}")
        print(f"Raw Text Received: {raw_text}")
        state["final_plan"] = {}
        
    return state

"""Creating graph"""
graph = StateGraph(State)
graph.add_node("add_data",add_data)
graph.add_node("get_response",get_response)
graph.add_node("check_stock",check_stock)
graph.add_edge("add_data","get_response")
graph.add_edge("get_response","check_stock")
graph.add_edge(START,"add_data")
graph.add_edge("get_response",END)

app = graph.compile()

human_prompt = HumanMessage(content="""Please analyze the current inventory network and recommend the optimal transfer routes.
Here is the data structure you must work with:
1. `deficency`: A dictionary where each key is a `store_id` currently experiencing a shortage, and the value is a list of `item_id`s that have fallen below their Reorder Point (ROP).
2. `store_distance_map`: A nested dictionary mapping each deficit store to all other available surplus stores, showing the estimated travel time (in hours) between them.
Based on this data, please select the best surplus store to fulfill the ROP for each deficit store. You must prioritize selecting the surplus store with the lowest estimated travel hours to minimize operational downtime.""")

system_instruction = SystemMessage(content="""You are an expert Supply Chain Logistics AI. 
Your primary objective is to optimize inventory redistribution across a network of stores. 
You specialize in analyzing Reorder Point (ROP) deficits and evaluating pairwise distance matrices to minimize logistical delays. 
When presented with inventory shortages and travel times, you must logically determine the single most efficient surplus store to fulfill each deficit, prioritizing the lowest possible travel time. 
Your output MUST be a valid JSON array containing objects strictly matching this structure, with no markdown code blocks, conversational text, or explanations whatsoever:
[
  {
    "deficit_store_id": "string",
    "deficient_items": [
      "string"
    ],
    "ranked_surplus_sources": [
      {
        "surplus_store_id": "string",
        "travel_time_hours": 0.0
      }
    ]
  }
]""")

input = {
    "prompt" : HumanMessage(content="""
"""),
    "instructions" : SystemMessage(content=""),
    "deficency" : {},
    "surplus_stores" : [],
    "stores_est_hours" : [[]],
}
app.invoke({
    "prompt": human_prompt,
    "instructions": system_instruction,
    "deficency": {},
    "store_distance_map": {}
})
# from IPython.display import Image, display

# display(Image(app.get_graph().draw_mermaid_png()))


