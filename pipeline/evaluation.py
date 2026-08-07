"""
You can create an simple scheduled script that runs daily to check the model's health:
Compare:It looks at what the model predicted for yesterday (d) versus the actual sales that just finalized in the database.
Calculate: It calculates the Mean Absolute Error (MAE) for the last 7 days.
Trigger: If the MAE crosses an unacceptable threshold (e.g., your error drifts from 2.58 to 4.50), 
the system automatically triggers the retraining pipeline to generate a fresh .pkl file.
""" 

import pandas as pd
from sklearn.metrics import mean_absolute_error
from sqlalchemy import create_engine
import subprocess

DB_URI = "postgresql+psycopg2://username:password@localhost:5432/your_database"
engine = create_engine(DB_URI)
MAE_THRESHOLD = 4.50

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

        # Calculates the overall MAE across all items, stores, and days in the 7-day window
        mae_7_day_avg = mean_absolute_error(df_eval['actual_demand'], df_eval['predicted_demand'])
        print(f"7-Day Rolling MAE: {mae_7_day_avg:.2f}")
        
        if mae_7_day_avg > MAE_THRESHOLD:
            print(f"ALERT: 7-Day MAE ({mae_7_day_avg:.2f}) exceeds threshold ({MAE_THRESHOLD}).")
            print("Triggering full model retrain on 3-year sliding window...")
            subprocess.run(["python", "model.py"], check=True)
        else:
            print("Model performance is stable over the past week. No retrain required.")
            
    except Exception as e:
        print(f"Evaluation failed: {e}")

if __name__ == "__main__":
    evaluate_model()