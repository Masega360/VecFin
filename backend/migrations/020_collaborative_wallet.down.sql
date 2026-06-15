DROP TABLE IF EXISTS transfer;
DROP TABLE IF EXISTS community_wallet;
DROP TABLE IF EXISTS wallet_member;
ALTER TABLE wallet RENAME COLUMN creator_id TO user_id;
