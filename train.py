import pandas as pd
from sklearn.model_selection import TimeSeriesSplit, GridSearchCV
from xgboost import XGBRegressor

data = pd.read_csv("engineered_features.csv")

# 1. we will do backfill an dtest the model ka performnace then will do with dropna let see kya hota    
data = data.sort_values(['store_id','item_id','date'])
X = data.drop(columns=['store_id','item_id','date','sales'])
Y = data['sales']
tscv = TimeSeriesSplit(n_splits=3)
model = XGBRegressor(objective='reg:squarederror', random_state=42)
param_grid = {
    'max_depth': [3, 5, 7],
    'learning_rate': [0.01, 0.1, 0.2],
    'n_estimators': [100, 300]
}
grid_search = GridSearchCV(
    estimator=model,
    param_grid=param_grid,
    cv=tscv,
    scoring='neg_mean_absolute_error', # MAE is highly interpretable for inventory
    verbose=3,
    n_jobs=2 # Uses all available CPU cores to speed up the search
)
print("Starting Grid Search. This may take a few minutes...")
grid_search.fit(X, Y)

# 8. Output the winning results
print("\n--- Grid Search Complete ---")
print(f"Best Hyperparameters: {grid_search.best_params_}")
print(f"Best Cross-Validation Score (Negative MAE): {grid_search.best_score_:.2f}")

# 9. Extract the ultimate, perfectly-tuned model
best_xgb_model = grid_search.best_estimator_