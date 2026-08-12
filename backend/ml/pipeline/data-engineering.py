import pandas as pd
import numpy as np
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os

load_dotenv()
# Database Configuration
DB_URL = os.getenv("DB_URL")
engine = create_engine(DB_URL)

def engineer_features():
    print("Engineering temporal features...")
    df = pd.read_csv("raw_data.csv")
    df['date'] = pd.to_datetime(df['date'])
    
    # Fetch Expanding stats from database directly
    expanding_query = """
        SELECT store_id, item_id, 
               all_time_sales_total AS expanding_sum, 
               all_time_sales_avg AS expanding_mean 
        FROM item_lifespan_stats
    """
    df_expanding = pd.read_sql(expanding_query, engine)
    df = df.merge(df_expanding, on=['store_id', 'item_id'], how='left')
    
    # Fill missing expanding values (for brand new items) with 0
    df['expanding_sum'] = df['expanding_sum'].fillna(0)
    df['expanding_mean'] = df['expanding_mean'].fillna(0)
    
    # Cyclical Date Features
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
    df['weekday_sin'] = np.sin(2 * np.pi * df['weekday'] / 7)
    df['weekday_cos'] = np.cos(2 * np.pi * df['weekday'] / 7)
    
    # Lags & Rolling Features (grouped by store and item)
    grouped = df.groupby(['store_id', 'item_id'])
    
    df['lag_1'] = grouped['sales'].shift(1)
    df['lag_2'] = grouped['sales'].shift(2)
    df['lag_7'] = grouped['sales'].shift(7)
    
    df['rolling_mean_7d'] = grouped['sales'].transform(lambda x: x.shift(1).rolling(7).mean())
    df['rolling_std_7d'] = grouped['sales'].transform(lambda x: x.shift(1).rolling(7).std())
    
    df['rolling_max_14d'] = grouped['sales'].transform(lambda x: x.shift(1).rolling(14).max())
    df['rolling_min_14d'] = grouped['sales'].transform(lambda x: x.shift(1).rolling(14).min())
    
    df['rolling_price_mean_30d'] = grouped['price'].transform(lambda x: x.shift(1).rolling(30).mean())
    df['promo_density_7d'] = grouped['promo'].transform(lambda x: x.shift(1).rolling(7).mean())
    
    # Price Ratio
    df['price_ratio'] = df['price'] / df['rolling_price_mean_30d']
    df['price_ratio'] = df['price_ratio'].fillna(1.0) # Domain-specific imputation
    
    # Handle NaNs for standard lags with backfill
    cols_to_bfill = ['lag_1', 'lag_2', 'lag_7', 'rolling_mean_7d', 'rolling_std_7d', 
                     'rolling_max_14d', 'rolling_min_14d', 'rolling_price_mean_30d', 'promo_density_7d']
    df[cols_to_bfill] = grouped[cols_to_bfill].bfill()
    df = df.fillna(0) # Final safety catch
    
    # Enforce Column Order
    final_columns = [
        'date', 'store_id', 'item_id', 'sales', 'price', 'promo', 'weekday', 'month',
        'lag_1', 'lag_2', 'lag_7', 'rolling_mean_7d', 'rolling_std_7d',
        'rolling_max_14d', 'rolling_min_14d', 'expanding_sum', 'expanding_mean', 
        'month_sin', 'month_cos', 'weekday_sin', 'weekday_cos', 
        'rolling_price_mean_30d', 'price_ratio', 'promo_density_7d'
    ]
    df = df[final_columns]
    
    df.to_csv("engineered_features.csv", index=False)
    print("Feature engineering complete. Saved to engineered_features.csv")

if __name__ == "__main__":
    engineer_features()