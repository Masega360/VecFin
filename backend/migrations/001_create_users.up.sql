CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    risk_type VARCHAR(50) DEFAULT 'conservative',
    registration_date TIMESTAMP DEFAULT NOW(),
    last_access TIMESTAMP,
    is_private BOOLEAN DEFAULT false,
    show_wallets BOOLEAN DEFAULT false,
    show_communities BOOLEAN DEFAULT false,
    show_posts BOOLEAN DEFAULT false
);