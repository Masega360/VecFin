CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL,
    parent_id UUID, -- NULL si es un post, UUID del post padre si es un comentario
    author_id UUID NOT NULL,

    title VARCHAR(255),
    content TEXT,
    url TEXT,

    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Relaciones (Integridad referencial)
    CONSTRAINT fk_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    -- Asumiendo que ya tienes o tendrás una tabla communities:
    -- CONSTRAINT fk_community FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
    CONSTRAINT fk_parent FOREIGN KEY (parent_id) REFERENCES posts(id) ON DELETE CASCADE
    );

CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);