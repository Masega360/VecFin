-- Pozo de liquidez global (marketplace)
CREATE TABLE IF NOT EXISTS market_pool (
    ticker VARCHAR(255) PRIMARY KEY,
    quantity DECIMAL NOT NULL DEFAULT 0
);

-- Historial de operaciones del marketplace
CREATE TABLE IF NOT EXISTS market_trade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    wallet_id UUID NOT NULL REFERENCES wallet(id),
    side VARCHAR(4) NOT NULL, -- 'buy' o 'sell'
    ticker VARCHAR(255) NOT NULL,
    quantity DECIMAL NOT NULL,
    price_usd DECIMAL NOT NULL, -- precio unitario al momento
    total_usd DECIMAL NOT NULL, -- quantity * price_usd
    pay_ticker VARCHAR(255), -- ticker usado para pagar (en buy)
    pay_quantity DECIMAL, -- cantidad pagada
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
