# to fetch data from the database and creating an csv of that for previous 3 years 
# date,store_id,item_id,sales,price,promo,weekday,month

import pandas as pd
import datetime
from app.core.config import settings
from pathlib import Path
from sqlalchemy import create_engine

engine = create_engine(settings.database_url)
PIPELINE_DIR = Path(__file__).resolve().parent

def collect_data():
    print("Collecting historical data from database...")
    
    # Query last 1 year of data
    query = """
        SELECT date, store_id, item_id, sales, price, promo 
        FROM raw_transactions 
        WHERE date >= CURRENT_DATE - INTERVAL '1 year'
        ORDER BY date ASC
    """
    df = pd.read_sql(query, engine)
    df['date'] = pd.to_datetime(df['date'])
    
    # Prepare placeholder for tomorrow
    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    
    # Get the unique store/item combinations
    unique_items = df[['store_id', 'item_id']].drop_duplicates()
    
    # We need tomorrow's price/promo. Assuming default values or fetching from a schedule table.
    tomorrow_rows = []
    for _, row in unique_items.iterrows():
        tomorrow_rows.append({
            'date': pd.to_datetime(tomorrow),
            'store_id': row['store_id'],
            'item_id': row['item_id'],
            'sales': float('nan'), # Target to predict
            'price': df[(df['store_id'] == row['store_id']) & (df['item_id'] == row['item_id'])]['price'].iloc[-1],
            'promo': 0 # Defaulting promo to 0
        })
    
    df_tomorrow = pd.DataFrame(tomorrow_rows)
    df_combined = pd.concat([df, df_tomorrow], ignore_index=True)
    
    # Add basic date features
    df_combined['weekday'] = df_combined['date'].dt.weekday
    df_combined['month'] = df_combined['date'].dt.month
    
    df_combined.to_csv("raw_data.csv", index=False)
    print("Data collection complete. Saved to raw_data.csv")

if __name__ == "__main__":
    collect_data()