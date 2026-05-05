CREATE TABLE IF NOT EXISTS asset_wallet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL,
    ticker VARCHAR(255) NOT NULL,
    quantity DECIMAL NOT NULL DEFAULT 0,

    CONSTRAINT fk_wallet
        FOREIGN KEY (wallet_id)
        REFERENCES wallet(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_wallet_ticker UNIQUE (wallet_id, ticker)
);
