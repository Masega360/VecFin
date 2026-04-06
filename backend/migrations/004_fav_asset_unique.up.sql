ALTER TABLE fav_asset ADD CONSTRAINT fav_asset_user_asset_unique UNIQUE (user_id, asset_id);
