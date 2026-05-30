DROP TABLE IF EXISTS asset_comment_likes;
ALTER TABLE asset_comments DROP COLUMN IF EXISTS parent_id;
ALTER TABLE asset_comments DROP COLUMN IF EXISTS likes;
