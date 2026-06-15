package repository

import (
	"context"
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresWalletMemberRepository struct{ db *sql.DB }

func NewPostgresWalletMemberRepository(db *sql.DB) *PostgresWalletMemberRepository {
	return &PostgresWalletMemberRepository{db: db}
}

func (r *PostgresWalletMemberRepository) Add(ctx context.Context, m domain.WalletMember) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO wallet_member (wallet_id, user_id, role) VALUES ($1, $2, $3)
		 ON CONFLICT (wallet_id, user_id) DO UPDATE SET role = $3`,
		m.WalletID, m.UserID, m.Role)
	return err
}

func (r *PostgresWalletMemberRepository) Remove(ctx context.Context, walletID, userID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM wallet_member WHERE wallet_id = $1 AND user_id = $2`, walletID, userID)
	return err
}

func (r *PostgresWalletMemberRepository) GetRole(ctx context.Context, walletID, userID uuid.UUID) (domain.WalletRole, error) {
	var role domain.WalletRole
	err := r.db.QueryRowContext(ctx,
		`SELECT role FROM wallet_member WHERE wallet_id = $1 AND user_id = $2`,
		walletID, userID).Scan(&role)
	if err == sql.ErrNoRows {
		return "", domain.ErrForbidden
	}
	return role, err
}

func (r *PostgresWalletMemberRepository) ListMembers(ctx context.Context, walletID uuid.UUID) ([]domain.WalletMemberView, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT wm.wallet_id, wm.user_id, wm.role, wm.joined_at, u.first_name, u.last_name
		FROM wallet_member wm JOIN users u ON wm.user_id = u.id
		WHERE wm.wallet_id = $1`, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var members []domain.WalletMemberView
	for rows.Next() {
		var m domain.WalletMemberView
		if err := rows.Scan(&m.WalletID, &m.UserID, &m.Role, &m.JoinedAt, &m.FirstName, &m.LastName); err != nil {
			return nil, err
		}
		members = append(members, m)
	}
	return members, rows.Err()
}

func (r *PostgresWalletMemberRepository) ListWalletsByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT w.id, w.creator_id, w.platform_id, w.name, w.api_key, w.api_secret, w.created_at, w.last_sync
		FROM wallet w JOIN wallet_member wm ON w.id = wm.wallet_id
		WHERE wm.user_id = $1 ORDER BY w.created_at DESC`, userID)
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
