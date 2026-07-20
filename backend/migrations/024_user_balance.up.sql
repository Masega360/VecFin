-- Saldo del usuario para uso de IA (se carga via MercadoPago)
CREATE TABLE IF NOT EXISTS user_balance (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    free_tokens_remaining INTEGER NOT NULL DEFAULT 5000,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Historial de pagos con MercadoPago
CREATE TABLE IF NOT EXISTS payment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mp_preference_id VARCHAR(255),
    mp_payment_id VARCHAR(255),
    amount_ars NUMERIC(12, 2) NOT NULL,
    amount_usd NUMERIC(12, 6) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_mp_preference ON payment_history(mp_preference_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_mp_payment ON payment_history(mp_payment_id);
