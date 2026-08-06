import pandas as pd

data = pd.read_csv("retail_sales.csv")

# print(data.info())
# print(data.describe())
# print(data.head())

from statsmodels.graphics.tsaplots import plot_acf
import matplotlib.pyplot as plt

df = data[(data["store_id"]=="store_1") & (data["item_id"]=="item_25")]
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date")

plot_acf(df["sales"],lags=35)
plt.show()