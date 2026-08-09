import pandas as pd
import numpy as np
import joblib
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os

load_dotenv()
# Database Configuration
DB_URL = os.getenv("DB_URL")
engine = create_engine(DB_URL)

# --- CHANGED START: Removed hardcoded LEAD_TIME_DAYS ---
Z_SCORE = 1.65
# --- CHANGED END ---

def get_item_costs(store_id, item_id):
    # --- CHANGED START: Fetch lead_time_days from DB ---
    """Fetch order cost (S), holding cost (H), and lead time from the database."""
    query = f"""
        SELECT order_cost, annual_holding_cost, lead_time_days 
        FROM inventory_metadata 
        WHERE store_id = {store_id} AND item_id = {item_id}
    """
    result = pd.read_sql(query, engine)
    if result.empty:
        return 50.0, 12.5, 3 # Default fallback with lead time
    return result['order_cost'].iloc[0], result['annual_holding_cost'].iloc[0], result['lead_time_days'].iloc[0]
    # --- CHANGED END ---

def predict_and_calculate():
    print("Running predictions for tomorrow...")
    df = pd.read_csv("engineered_features.csv")
    model = joblib.load("demand-forecasting-01.pkl")
    
    # --- CHANGED START: Define exact feature columns in order to prevent XGBoost mismatch ---
    feature_cols = [
        'price', 'promo', 'weekday', 'month', 'lag_1', 'lag_2', 'lag_7', 
        'rolling_mean_7d', 'rolling_std_7d', 'rolling_max_14d', 'rolling_min_14d', 
        'expanding_sum', 'expanding_mean', 'month_sin', 'month_cos', 
        'weekday_sin', 'weekday_cos', 'rolling_price_mean_30d', 'price_ratio', 
        'promo_density_7d'
    ]
    # --- CHANGED END ---
    
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
        
        # --- CHANGED START: Pass the strictly ordered feature list instead of dynamically dropping columns ---
        X = row[feature_cols].to_frame().T.astype(float)
        # --- CHANGED END ---
        
        # Predict Demand
        pred_d = float(model.predict(X)[0])
        pred_d = max(0.0, pred_d)
        
        # --- CHANGED START: Unpack lead_time_days dynamically from DB and apply to ROP ---
        order_cost, holding_cost, lead_time_days = get_item_costs(store, item)
        safety_stock = Z_SCORE * demand_std_dev * np.sqrt(lead_time_days)
        rop = (pred_d * lead_time_days) + safety_stock
        # --- CHANGED END ---
        
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