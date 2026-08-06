import pandas as pd
import numpy as np

def engineer_demand_features(df):
    """
    Extracts time-series features from a dataframe containing:
    date, store_id, item_id, sales, price, promo, weekday, month
    """
    # 1. Sort the data to ensure chronological integrity
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(by=['store_id', 'item_id', 'date']).reset_index(drop=True)
    
    # Create a grouped object to prevent data leakage across different stores/items
    grouped_sales = df.groupby(['store_id', 'item_id'])['sales']

    # ==========================================
    # 2. Lag Features
    # ==========================================
    df['lag_1'] = grouped_sales.shift(1)
    df['lag_2'] = grouped_sales.shift(2)
    df['lag_7'] = grouped_sales.shift(7)

    # ==========================================
    # 3. Rolling (Window) Features
    # ==========================================
    # Shift by 1 first to prevent data leakage (using today's sales to predict today)
    shifted_sales = grouped_sales.shift(1)
    
    df['rolling_mean_7d'] = shifted_sales.rolling(window=7).mean()
    df['rolling_std_7d'] = shifted_sales.rolling(window=7).std()
    df['rolling_max_14d'] = shifted_sales.rolling(window=14).max()
    df['rolling_min_14d'] = shifted_sales.rolling(window=14).min()

    # ==========================================
    # 4. Expanding Window Features
    # ==========================================
    df['expanding_sum'] = shifted_sales.expanding().sum()
    df['expanding_mean'] = shifted_sales.expanding().mean()

    # ==========================================
    # 5. Datetime and Cyclical Features
    # ==========================================
    # Assuming 'month' is 1-12 and 'weekday' is 0-6
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
    
    df['weekday_sin'] = np.sin(2 * np.pi * df['weekday'] / 7)
    df['weekday_cos'] = np.cos(2 * np.pi * df['weekday'] / 7)

    # ==========================================
    # 6. Exogenous (Contextual) Features
    # ==========================================
    # Price Elasticity: Compare today's price to the 30-day historical average price
    grouped_price = df.groupby(['store_id', 'item_id'])['price'].shift(1)
    df['rolling_price_mean_30d'] = grouped_price.rolling(window=30).mean()
    
    # Ratio > 1 means a price hike; Ratio < 1 means a discount
    df['price_ratio'] = df['price'] / df['rolling_price_mean_30d']
    
    # Promo Density: How often was this item on promo in the last 7 days?
    df['promo_density_7d'] = df.groupby(['store_id', 'item_id'])['promo'].shift(1).rolling(window=7).mean()

    return df

data  = pd.read_csv("retail_sales.csv")
data = engineer_demand_features(data)
# print(data.head(31))
group = data.groupby(['store_id','item_id'])
cols = [
    'lag_1', 'lag_2', 'lag_7', 
    'rolling_mean_7d', 'rolling_std_7d', 
    'rolling_max_14d', 'rolling_min_14d', 
    'rolling_price_mean_30d', 'promo_density_7d',
    'expanding_mean'
]
data[cols] = group[cols].bfill()
data["expanding_sum"] = data["expanding_sum"].fillna(0)
data["price_ratio"] = data["price_ratio"].fillna(1)
print(data.isna().sum())
data.to_csv("engineered_features.csv",index=False)