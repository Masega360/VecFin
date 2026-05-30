CREATE TABLE financial_plans (
    id UUID PRIMARY KEY,
    financier_name VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    tna DECIMAL(5, 2) NOT NULL,
    min_days INT NOT NULL,
    min_amount DECIMAL(15, 2) NOT NULL
);

INSERT INTO financial_plans (id, financier_name, name, type, tna, min_days, min_amount) VALUES
( gen_random_uuid(), 'Banco Nación', 'Plazo Fijo Tradicional', 'plazo_fijo', 40.00, 30, 15000.00),
( gen_random_uuid(), 'Banco Galicia', 'Plazo Fijo Clásico', 'plazo_fijo', 39.50, 30, 10000.00),

( gen_random_uuid(), 'Mercado Pago', 'Cuenta Remunerada', 'fci', 35.20, 1, 1.00),
( gen_random_uuid(), 'Naranja X', 'Cuenta Remunerada', 'fci', 42.00, 1, 1.00),
( gen_random_uuid(), 'Ualá', 'Fondo Común de Inversión', 'fci', 34.80, 1, 1.00),
( gen_random_uuid(), 'Personal Pay', 'Cuenta Remunerada (Nivel 3)', 'fci', 41.50, 1, 1.00)
;
