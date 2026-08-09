"""
You can create an simple scheduled script that runs daily to check the model's health:
Compare:It looks at what the model predicted for yesterday (d) versus the actual sales that just finalized in the database.
Calculate: It calculates the Mean Absolute Error (MAE) for the last 7 days.
Trigger: If the MAE crosses an unacceptable threshold (e.g., your error drifts from 2.58 to 4.50), 
the system automatically triggers the retraining pipeline to generate a fresh .pkl file.
""" 

import pandas as pd
# --- CHANGED START ---
from sklearn.metrics import mean_absolute_percentage_error
# --- CHANGED END ---
from sqlalchemy import create_engine
import subprocess
from dotenv import load_dotenv
import os
# --- CHANGED START ---
import sys
# --- CHANGED END ---

load_dotenv()
# Database Configuration
DB_URL = os.getenv("DB_URL")
engine = create_engine(DB_URL)

# --- CHANGED START ---
# Define a 20% global error threshold using MAPE
MAPE_THRESHOLD = 0.20
# --- CHANGED END ---

def evaluate_model():
    print("Evaluating predictions against actuals for the past 7 days...")
    
    # Pull predictions and actual sales for the last 7 completed days
    query = """
        SELECT p.store_id, p.item_id, p.predicted_demand, r.sales AS actual_demand
        FROM daily_predictions p
        JOIN raw_transactions r 
          ON p.store_id = r.store_id 
         AND p.item_id = r.item_id 
         AND p.prediction_date = r.date
        WHERE p.prediction_date BETWEEN CURRENT_DATE - INTERVAL '7 days' 
                                    AND CURRENT_DATE - INTERVAL '1 day'
    """
    try:
        df_eval = pd.read_sql(query, engine)
        
        if df_eval.empty:
            print("No evaluation data available yet for the past 7 days.")
            return

        # --- CHANGED START ---
        # Calculates the overall MAPE across all items, stores, and days in the 7-day window
        # Scikit-learn handles division by zero automatically under the hood
        mape_7_day_avg = mean_absolute_percentage_error(df_eval['actual_demand'], df_eval['predicted_demand'])
        
        # Display as a formatted percentage (e.g., 0.154 -> 15.4%)
        print(f"7-Day Rolling MAPE: {mape_7_day_avg:.1%}")
        
        if mape_7_day_avg > MAPE_THRESHOLD:
            print(f"ALERT: 7-Day MAPE ({mape_7_day_avg:.1%}) exceeds threshold ({MAPE_THRESHOLD:.1%}).")
            print("Triggering full model retrain on 3-year sliding window...")
            
            # Using sys.executable guarantees the retrain runs in your active virtual environment
            subprocess.run([sys.executable, "model.py"], check=True)
        else:
            print("Model performance is stable over the past week. No retrain required.")
        # --- CHANGED END ---
            
    except Exception as e:
        print(f"Evaluation failed: {e}")

if __name__ == "__main__":
    evaluate_model()