CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL,
    name VARCHAR(64) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    rules TEXT NOT NULL,
    topics TEXT[] DEFAULT '{}',
    logo_url TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    creation_date TIMESTAMP DEFAULT NOW(),
    member_count INTEGER DEFAULT 1,
    post_count INTEGER DEFAULT 0,

    CONSTRAINT fk_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE IF NOT EXISTS community_members (
    community_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT 'member', -- 'owner', 'moderator', 'member'
    joined_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (community_id, user_id),
    CONSTRAINT fk_community FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- Tabla de Solicitudes de Union (Para comunidades privadas)
CREATE TABLE IF NOT EXISTS community_join_requests (
    community_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (community_id, user_id, created_at),
    CONSTRAINT fk_community_req FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_req FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

-- Índices para mejorar el rendimiento de las búsquedas
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_communities_name ON communities(name);