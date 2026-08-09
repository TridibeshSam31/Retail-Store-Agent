import pandas as pd
import xgboost as xgb
import joblib
from sqlalchemy import create_engine
from sklearn.model_selection import TimeSeriesSplit, GridSearchCV
from dotenv import load_dotenv
import os

load_dotenv()
# Database Configuration
DB_URL = os.getenv("DB_URL")
engine = create_engine(DB_URL)


def retrain_model():
    print("Starting full model retrain from scratch...")
    
    # 1. Pull 3 years of data
    query = """
        SELECT date, store_id, item_id, sales, price, promo 
        FROM raw_transactions 
        WHERE date >= CURRENT_DATE - INTERVAL '3 years'
        ORDER BY date ASC
    """
    df = pd.read_sql(query, engine)
    
    # NOTE: In production, you would import and run your `engineer_features()` 
    # logic here to transform this raw 3-year DF into the engineered schema.
    # Assuming `df_clean` is the output of that process:
    # df_clean = full_historical_engineering_pipeline(df) 
    
    # For this script's execution, we will load the engineered_features as a proxy
    if not os.path.exists("engineered_features.csv"):
        raise FileNotFoundError("Missing engineered features for training.")
        
    df_clean = pd.read_csv("engineered_features.csv")
    df_clean = df_clean.dropna().sort_values(by=['store_id', 'item_id', 'date'])
    
    X = df_clean.drop(columns=['date', 'sales', 'store_id', 'item_id'])
    y = df_clean['sales']
    
    # 2. Setup TimeSeriesSplit & GridSearch
    tscv = TimeSeriesSplit(n_splits=3)
    model = xgb.XGBRegressor(objective='reg:squarederror', random_state=42)
    
    param_grid = {
        'max_depth': [3, 5, 7],
        'learning_rate': [0.01, 0.1],
        'n_estimators': [100, 300]
    }
    
    grid_search = GridSearchCV(
        estimator=model,
        param_grid=param_grid,
        cv=tscv,
        scoring='neg_mean_absolute_error',
        verbose=3,
        n_jobs=2
    )
    
    print("Executing TimeSeries Grid Search...")
    grid_search.fit(X, y)
    
    print(f"Best Hyperparameters: {grid_search.best_params_}")
    
    # 3. Save the winning model matching the filename in image_48332c.png
    best_model = grid_search.best_estimator_
    joblib.dump(best_model, 'demand-forecasting-01.pkl')
    print("New model trained and saved successfully as demand-forecasting-01.pkl")

if __name__ == "__main__":
    retrain_model()