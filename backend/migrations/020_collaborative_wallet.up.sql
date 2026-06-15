-- Renombrar user_id a creator_id en wallet
ALTER TABLE wallet RENAME COLUMN user_id TO creator_id;

-- Tabla N:N entre users y wallets (colaborativa)
CREATE TABLE IF NOT EXISTS wallet_member (
    wallet_id UUID NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer', -- owner, admin, viewer
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (wallet_id, user_id)
);

-- Wallets de comunidad (fondos comunitarios)
CREATE TABLE IF NOT EXISTS community_wallet (
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (community_id, wallet_id)
);

-- Transferencias entre wallets
CREATE TABLE IF NOT EXISTS transfer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_wallet_id UUID NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
    to_wallet_id UUID NOT NULL REFERENCES wallet(id) ON DELETE CASCADE,
    ticker VARCHAR(255) NOT NULL,
    quantity DECIMAL NOT NULL,
    note TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migrar datos: cada wallet existente, su creator es owner en wallet_member
INSERT INTO wallet_member (wallet_id, user_id, role)
SELECT id, creator_id, 'owner' FROM wallet;
