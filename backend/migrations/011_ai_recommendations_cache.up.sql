CREATE TABLE ai_recommendations_cache (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       JSONB        NOT NULL,
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
