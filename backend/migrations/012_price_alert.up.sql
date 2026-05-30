CREATE TABLE IF NOT EXISTS price_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(50) NOT NULL,
    target_price NUMERIC(15, 6) NOT NULL,
    condition VARCHAR(10) NOT NULL,       -- 'ABOVE' o 'BELOW'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX idx_price_alerts_symbol_active
    ON price_alerts(symbol)
    WHERE is_active = true;