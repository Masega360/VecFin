CREATE TABLE IF NOT EXISTS platform (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT
);

INSERT INTO platform (name, description)
VALUES
    ('Binance', 'Exchange de criptoactivos'),
    ('custom', 'datos cargados manualmente');