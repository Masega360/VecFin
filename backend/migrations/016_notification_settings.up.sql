CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    price_alerts BOOLEAN NOT NULL DEFAULT true,
    community_activity BOOLEAN NOT NULL DEFAULT true,
    new_members BOOLEAN NOT NULL DEFAULT false,
    marketing BOOLEAN NOT NULL DEFAULT false,

    enabled_channels TEXT[] NOT NULL DEFAULT '{"EMAIL", "IN_APP"}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar el updated_at automáticamente
CREATE TRIGGER update_notification_settings_modtime
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();