package repository

import (
	"context"
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresCommunityWalletRepository struct{ db *sql.DB }

func NewPostgresCommunityWalletRepository(db *sql.DB) *PostgresCommunityWalletRepository {
	return &PostgresCommunityWalletRepository{db: db}
}

func (r *PostgresCommunityWalletRepository) Link(ctx context.Context, communityID, walletID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO community_wallet (community_id, wallet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		communityID, walletID)
	return err
}

func (r *PostgresCommunityWalletRepository) Unlink(ctx context.Context, communityID, walletID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM community_wallet WHERE community_id = $1 AND wallet_id = $2`,
		communityID, walletID)
	return err
}

func (r *PostgresCommunityWalletRepository) ListByCommunity(ctx context.Context, communityID uuid.UUID) ([]domain.Wallet, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT w.id, w.creator_id, w.platform_id, w.name, w.api_key, w.api_secret, w.created_at, w.last_sync
		FROM wallet w JOIN community_wallet cw ON w.id = cw.wallet_id
		WHERE cw.community_id = $1`, communityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var wallets []domain.Wallet
	for rows.Next() {
		var w domain.Wallet
		var lastSync sql.NullTime
		if err := rows.Scan(&w.ID, &w.CreatorID, &w.PlatformID, &w.Name, &w.APIKey, &w.APISecret, &w.CreatedAt, &lastSync); err != nil {
			return nil, err
		}
		if lastSync.Valid {
			w.LastSync = lastSync.Time
		}
		wallets = append(wallets, w)
	}
	return wallets, rows.Err()
}
