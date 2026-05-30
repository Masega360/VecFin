ALTER TABLE asset_comments ADD COLUMN parent_id UUID REFERENCES asset_comments(id) ON DELETE CASCADE;
ALTER TABLE asset_comments ADD COLUMN likes INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS asset_comment_likes (
    comment_id UUID NOT NULL REFERENCES asset_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);
