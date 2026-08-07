import pandas as pd
import numpy as np
import joblib
from sqlalchemy import create_engine

DB_URI = "postgresql+psycopg2://username:password@localhost:5432/your_database"
engine = create_engine(DB_URI)

LEAD_TIME_DAYS = 3
Z_SCORE = 1.65

def get_item_costs(store_id, item_id):
    """Fetch order cost (S) and holding cost (H) from the database."""
    query = f"""
        SELECT order_cost, annual_holding_cost 
        FROM inventory_metadata 
        WHERE store_id = {store_id} AND item_id = {item_id}
    """
    result = pd.read_sql(query, engine)
    if result.empty:
        return 50.0, 12.5 # Default fallback
    return result['order_cost'].iloc[0], result['annual_holding_cost'].iloc[0]

def predict_and_calculate():
    print("Running predictions for tomorrow...")
    df = pd.read_csv("engineered_features.csv")
    model = joblib.load("demand-forecasting-01.pkl")
    
    # Filter strictly for tomorrow's placeholder rows (where sales is exactly 0 due to fillna)
    # To be safe, filter by the maximum date in the dataset
    tomorrow_date = df['date'].max()
    df_tomorrow = df[df['date'] == tomorrow_date].copy()
    
    predictions = []
    
    for _, row in df_tomorrow.iterrows():
        store = row['store_id']
        item = row['item_id']
        
        # Calculate dynamic demand volatility from the last 30 days of actuals
        historical = df[(df['store_id'] == store) & (df['item_id'] == item) & (df['date'] < tomorrow_date)]
        demand_std_dev = historical['sales'].tail(30).std() if not historical.empty else 0.0
        if pd.isna(demand_std_dev): demand_std_dev = 0.0
        
        # Prepare feature vector (drop non-predictive columns)
        X = row.drop(['date', 'sales', 'store_id', 'item_id']).to_frame().T
        
        # Predict Demand
        pred_d = float(model.predict(X)[0])
        pred_d = max(0.0, pred_d)
        
        # Calculate EOQ & ROP
        order_cost, holding_cost = get_item_costs(store, item)
        safety_stock = Z_SCORE * demand_std_dev * np.sqrt(LEAD_TIME_DAYS)
        rop = (pred_d * LEAD_TIME_DAYS) + safety_stock
        
        annual_demand = pred_d * 365
        eoq = np.sqrt((2 * annual_demand * order_cost) / holding_cost) if holding_cost > 0 else 0
        
        predictions.append({
            'store_id': store,
            'item_id': item,
            'predicted_demand': round(pred_d, 2),
            'rop': int(np.ceil(rop)),
            'eoq': int(np.ceil(eoq))
        })
        
    df_results = pd.DataFrame(predictions)
    df_results.to_csv("tomorrow_predictions.csv", index=False)
    print("Predictions and Inventory Targets saved to tomorrow_predictions.csv")

if __name__ == "__main__":
    predict_and_calculate()