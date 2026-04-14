CREATE TABLE IF NOT EXISTS plataform (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT
);

INSERT INTO plataform (name, description)
VALUES
    ('Binance', 'Exchange de criptoactivos'),
    ('custom', 'datos cargados manualmente');