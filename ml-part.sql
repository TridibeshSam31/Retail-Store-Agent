-- ==========================================
-- 1. Dimension Tables
-- ==========================================

CREATE TABLE stores (
    store_id SERIAL PRIMARY KEY,
    location_name VARCHAR(100) NOT NULL
);

CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL
);

-- ==========================================
-- 2. Configuration Table
-- ==========================================

CREATE TABLE inventory_metadata (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    order_cost DECIMAL(10,2) NOT NULL,
    annual_holding_cost DECIMAL(10,2) NOT NULL,
    lead_time_days INT DEFAULT 3,
    PRIMARY KEY (store_id, item_id)
);

-- ==========================================
-- 3. Fact Table
-- ==========================================

CREATE TABLE raw_transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    sales INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    promo INT DEFAULT 0
);

-- Composite index for fast historical lookbacks
CREATE INDEX idx_raw_transactions_date_store_item 
ON raw_transactions (date, store_id, item_id);

-- ==========================================
-- 4. Tracking Table
-- ==========================================

CREATE TABLE item_lifespan_stats (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    all_time_sales_total BIGINT DEFAULT 0,
    total_days_active INT DEFAULT 0,
    all_time_sales_avg DECIMAL(10,2) DEFAULT 0.00,
    PRIMARY KEY (store_id, item_id)
);

-- Automated Trigger to update item_lifespan_stats upon new sales
CREATE OR REPLACE FUNCTION update_item_lifespan_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO item_lifespan_stats (store_id, item_id, all_time_sales_total, total_days_active, all_time_sales_avg)
    VALUES (NEW.store_id, NEW.item_id, NEW.sales, 1, NEW.sales)
    ON CONFLICT (store_id, item_id)
    DO UPDATE SET
        all_time_sales_total = item_lifespan_stats.all_time_sales_total + NEW.sales,
        total_days_active = item_lifespan_stats.total_days_active + 1,
        all_time_sales_avg = (item_lifespan_stats.all_time_sales_total + NEW.sales)::DECIMAL / (item_lifespan_stats.total_days_active + 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_raw_transaction_insert
AFTER INSERT ON raw_transactions
FOR EACH ROW
EXECUTE FUNCTION update_item_lifespan_stats();

-- ==========================================
-- 5. Output Table
-- ==========================================

CREATE TABLE daily_predictions (
    prediction_date DATE,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    predicted_demand DECIMAL(10,2) NOT NULL,
    rop INT NOT NULL,
    eoq INT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (prediction_date, store_id, item_id)
);