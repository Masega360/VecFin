CREATE TABLE IF NOT EXISTS wallet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Clave foránea a tu tabla de usuarios
    plataform_id UUID NOT NULL,
    name VARCHAR(255), -- Ej: "Mi cuenta de ahorros Binance"
    api_key VARCHAR(255) NOT NULL,
    api_secret VARCHAR(255) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- La restricción FK asegura que no se pueda crear una wallet 
    -- para una plataforma que no existe en tu tabla 'plataform'
    CONSTRAINT fk_plataform 
        FOREIGN KEY (plataform_id) 
        REFERENCES plataform(id)
        ON DELETE RESTRICT
);