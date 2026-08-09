## This doc is for my own understanding of the ML part of the project.

combine Operations Research (Inventory Math) with Predictive ML. The ML model doesn't predict the restock action directly; it predicts the future demand. You then plug that prediction into standard inventory formulas to get your exact "When" and "How Much."Here is the exact math and how to apply it, followed by the best datasets to train on.1. The Math: When to Restock (Reorder Point)You need to calculate the Reorder Point (ROP). This is the exact inventory level at which an order must be placed so you don't stock out while waiting for the supplier.The standard formula is:$$ROP = (\hat{d} \times L) + S_{\text{safety}}$$Where:$\hat{d}$ is your Predicted Daily Demand (This is what your ML model predicts).$L$ is the Lead Time (How many days it takes for the supplier to deliver).$S_{\text{safety}}$ is the Safety Stock.To calculate the Safety Stock mathematically, you use the standard deviation of your demand to buffer against unexpected shocks:$$S_{\text{safety}} = Z \times \sigma_d \times \sqrt{L}$$Where:$Z$ is the Z-score for your desired service level (e.g., 1.65 for a 95% confidence that you won't stock out).$\sigma_d$ is the standard deviation of historical daily demand.How ML fits in: Instead of using a simple historical average for $\hat{d}$, your ML model outputs a highly accurate prediction for $\hat{d}$ by looking at trends, seasonality, and local events.2. The Math: How Much to Restock (Order Quantity)Once your inventory hits the ROP, you need to know exactly how many units to order. The most robust mathematical model for this is the Economic Order Quantity (EOQ).The EOQ finds the sweet spot that minimizes both the cost of ordering goods and the cost of storing them (holding cost).$$EOQ = \sqrt{\frac{2 \times \hat{D} \times S}{H}}$$Where:$\hat{D}$ is the Predicted Annual Demand (Scaled up from your ML model's daily predictions).$S$ is the Setup/Ordering Cost (The fixed cost of placing a transfer or order, e.g., shipping fees or labor).$H$ is the Holding Cost (The cost to store one unit of the item for a year, e.g., warehousing, refrigeration, dead-stock risk).

1. How to Find the Z-Score ($Z$)The $Z$ value is not something your ML model predicts, nor is it extracted from your sales data. It is a business decision called the "Service Level."The Service Level is the probability that a store will not stock out during the lead time. You choose the percentage, and that percentage maps to a standard $Z$ value on a normal distribution curve.Here are the standard targets retail chains use:90% Service Level: $Z = 1.28$ (Used for non-essential items)95% Service Level: $Z = 1.65$ (Standard for most inventory)99% Service Level: $Z = 2.33$ (Used for critical essentials, like baby formula or medicine)
```python
from scipy.stats import norm
service_level = 0.95
z_score = norm.ppf(service_level) 
print(f"Z-Score: {z_score:.2f}") # Outputs: 1.65
```

2. How to Find the Standard Deviation of Demand ($\sigma_d$)The variable $\sigma_d$ measures how volatile your historical sales are. If a store sells exactly 10 bottles of milk every single day, the standard deviation is 0. If they sell 2 bottles one day and 50 the next, the standard deviation is very high, meaning you need more safety stock.You calculate this directly from your historical sales dataset using a rolling window (e.g., looking at the volatility over the last 30 days).

```python
import pandas as pd

# Assuming you have a dataframe 'df' with columns: 'date', 'stockID', 'qty_sold'
df = df.sort_values(by=['stockID', 'date'])

# Calculate the rolling 30-day standard deviation of sales for each specific item
df['sigma_d'] = df.groupby('stockID')['qty_sold'].transform(
    lambda x: x.rolling(window=30, min_periods=1).std()
)
```
### Found the model to predict d using XGBOOST
```--- Grid Search Complete ---
Best Hyperparameters: {'learning_rate': 0.1, 'max_depth': 7, 'n_estimators': 300}
Best Cross-Validation Score (Negative MAE): -2.58
```


# Demand Forecasting & Inventory Agent Database Schema

This document outlines the PostgreSQL relational database schema used to support the machine learning data pipeline and LangGraph agent operations.

## 1. Dimension Tables (Static Data)
These tables hold the core static entities of the retail network.

### `stores`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `store_id` | `SERIAL` | `PRIMARY KEY` | Unique identifier for each retail location. |
| `location_name` | `VARCHAR(100)` | `NOT NULL` | City or neighborhood of the store. |

### `items`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `item_id` | `SERIAL` | `PRIMARY KEY` | Unique identifier for each product. |
| `item_name` | `VARCHAR(150)` | `NOT NULL` | The name of the product. |
| `category` | `VARCHAR(50)` | `NOT NULL` | The product family (e.g., Electronics, Consumables). |

---

## 2. Configuration Table (Logistics & Costs)
This table provides the static logistics variables required by the prediction script to calculate operations research metrics.

### `inventory_metadata`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `store_id` | `INT` | `PK, FK` | References `stores(store_id)`. |
| `item_id` | `INT` | `PK, FK` | References `items(item_id)`. |
| `order_cost` | `DECIMAL(10,2)` | `NOT NULL` | The setup/shipping cost ($S$) per order. |
| `annual_holding_cost`| `DECIMAL(10,2)` | `NOT NULL` | The cost to store one unit for a year ($H$). |
| `lead_time_days` | `INT` | `DEFAULT 3` | Days it takes for stock to arrive. |

---

## 3. Fact Table (The ML Fuel)
This is the core, high-velocity table queried by the data collection and modeling scripts to build temporal features and train the XGBoost algorithm.

### `raw_transactions`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `transaction_id` | `BIGSERIAL` | `PRIMARY KEY` | Unique ID for the daily aggregate. |
| `date` | `DATE` | `NOT NULL` | The date of the sales record. |
| `store_id` | `INT` | `FK` | References `stores(store_id)`. |
| `item_id` | `INT` | `FK` | References `items(item_id)`. |
| `sales` | `INT` | `NOT NULL` | Total units sold that day. |
| `price` | `DECIMAL(10,2)` | `NOT NULL` | The selling price that day. |
| `promo` | `INT` | `DEFAULT 0` | Binary indicator (1 = Promo, 0 = No Promo). |

*Note: A composite index exists on `(date, store_id, item_id)` to ensure historical rolling-window queries execute rapidly.*

---

## 4. Tracking Table (Database-Level Feature Engineering)
To optimize pipeline memory, this table pre-aggregates expanding statistical features, avoiding the need to recalculate complete historical data in Python.

### `item_lifespan_stats`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `store_id` | `INT` | `PK, FK` | References `stores(store_id)`. |
| `item_id` | `INT` | `PK, FK` | References `items(item_id)`. |
| `all_time_sales_total`| `BIGINT` | `DEFAULT 0` | The pre-calculated `expanding_sum`. |
| `total_days_active` | `INT` | `DEFAULT 0` | The denominator for calculating the mean. |
| `all_time_sales_avg` | `DECIMAL(10,2)` | `DEFAULT 0.00`| The pre-calculated `expanding_mean`. |

*Note: This table is maintained automatically via a PostgreSQL `TRIGGER`. Inserting a new row into `raw_transactions` instantaneously updates these cumulative metrics.*

---

## 5. Output Table (Agent Interfacing & Evaluation)
This table acts as the bridge between the ML pipeline and the business logic. It stores daily inferences for agent action and model evaluation.

### `daily_predictions`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `prediction_date` | `DATE` | `PK` | The future date this prediction applies to. |
| `store_id` | `INT` | `PK, FK` | References `stores(store_id)`. |
| `item_id` | `INT` | `PK, FK` | References `items(item_id)`. |
| `predicted_demand` | `DECIMAL(10,2)` | `NOT NULL` | The $\hat{d}$ output from XGBoost. |
| `rop` | `INT` | `NOT NULL` | Calculated Reorder Point. |
| `eoq` | `INT` | `NOT NULL` | Calculated Economic Order Quantity. |
| `created_at` | `TIMESTAMP` | `DEFAULT NOW()`| The exact system time the pipeline ran. |