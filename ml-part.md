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