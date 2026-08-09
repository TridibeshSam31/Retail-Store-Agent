CREATE TABLE orgs (
    org_id SERIAL PRIMARY KEY,
    org_name VARCHAR(100) NOT NULL
);

CREATE TABLE stores (
    store_id SERIAL PRIMARY KEY,
    org_id INT REFERENCES orgs(org_id) NOT NULL,
    location_name VARCHAR(100) NOT NULL,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6)
);

CREATE TABLE store_distances (
    store_id_a INT REFERENCES stores(store_id),
    store_id_b INT REFERENCES stores(store_id),
    tier VARCHAR(10) NOT NULL,    
    est_hours DECIMAL(5,2) NOT NULL,
    PRIMARY KEY (store_id_a, store_id_b)
);


CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL      
);

CREATE TABLE inventory_metadata (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    order_cost DECIMAL(10,2) NOT NULL,
    annual_holding_cost DECIMAL(10,2) NOT NULL,
    lead_time_days INT DEFAULT 3,
    PRIMARY KEY (store_id, item_id)
);

CREATE TABLE current_inventory (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    qty_on_hand INT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (store_id, item_id)
);

CREATE TABLE item_batches (
    batch_id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    qty INT NOT NULL,
    expiry_date DATE
);


CREATE TABLE raw_transactions (
    transaction_id BIGSERIAL PRIMARY KEY,
    date DATE NOT NULL,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    sales INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    promo INT DEFAULT 0
);

CREATE INDEX idx_raw_transactions_date_store_item
ON raw_transactions (date, store_id, item_id);

CREATE TABLE item_lifespan_stats (
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    all_time_sales_total BIGINT DEFAULT 0,
    total_days_active INT DEFAULT 0,
    all_time_sales_avg DECIMAL(10,2) DEFAULT 0.00,
    PRIMARY KEY (store_id, item_id)
);

CREATE OR REPLACE FUNCTION update_item_lifespan_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO item_lifespan_stats (store_id, item_id, all_time_sales_total, total_days_active, all_time_sales_avg)
    VALUES (NEW.store_id, NEW.item_id, NEW.sales, 1, NEW.sales)
    ON CONFLICT (store_id, item_id)
    DO UPDATE SET
        all_time_sales_total = item_lifespan_stats.all_time_sales_total + NEW.sales,
        total_days_active = item_lifespan_stats.total_days_active + 1,
        all_time_sales_avg = (item_lifespan_stats.all_time_sales_total + NEW.sales)::DECIMAL
                              / (item_lifespan_stats.total_days_active + 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_raw_transaction_insert
AFTER INSERT ON raw_transactions
FOR EACH ROW
EXECUTE FUNCTION update_item_lifespan_stats();

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


CREATE TABLE suppliers (
    supplier_id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    name VARCHAR(150),
    phone VARCHAR(20),
    email VARCHAR(150),
    pref VARCHAR(10)              
);

CREATE TABLE negotiations (
    negotiation_id SERIAL PRIMARY KEY,
    org_id INT REFERENCES orgs(org_id),
    item_id INT REFERENCES items(item_id),
    initiator_store_id INT REFERENCES stores(store_id),
    trigger_type VARCHAR(20) NOT NULL,  
    status VARCHAR(20) NOT NULL,        
    resolution_type VARCHAR(20),        
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE negotiation_turns (
    turn_id SERIAL PRIMARY KEY,
    negotiation_id INT REFERENCES negotiations(negotiation_id),
    store_id INT REFERENCES stores(store_id),
    turn_number INT NOT NULL,
    argument_text TEXT,
    responded BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transfers (
    transfer_id SERIAL PRIMARY KEY,
    negotiation_id INT REFERENCES negotiations(negotiation_id),
    from_store_id INT REFERENCES stores(store_id),
    to_store_id INT REFERENCES stores(store_id),
    item_id INT REFERENCES items(item_id),
    qty INT NOT NULL,
    confirmed_from BOOLEAN DEFAULT FALSE,
    confirmed_to BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP
);


CREATE TABLE config (
    org_id INT REFERENCES orgs(org_id) PRIMARY KEY,
    batch_x INT NOT NULL,
    max_negotiation_turns INT NOT NULL
);