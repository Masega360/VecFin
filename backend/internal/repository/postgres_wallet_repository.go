package repository

import (
	"context"
	"database/sql"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresWalletRepository struct {
	db *sql.DB
}

func (r *PostgresWalletRepository) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error) {
	query := `
		SELECT id, user_id, platform_id, name, api_key, api_secret, created_at, last_sync
		FROM wallet
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var wallets []domain.Wallet
	for rows.Next() {
		var w domain.Wallet
		var lastSync sql.NullTime
		if err := rows.Scan(
			&w.ID, &w.UserID, &w.PlatformID, &w.Name,
			&w.APIKey, &w.APISecret,
			&w.CreatedAt, &lastSync,
		); err != nil {
			return nil, err
		}
		if lastSync.Valid {
			w.LastSync = lastSync.Time
		}
		wallets = append(wallets, w)
	}
	return wallets, rows.Err()
}

func (r *PostgresWalletRepository) UpdateLastSync(ctx context.Context, id uuid.UUID, t time.Time) error {
	_, err := r.db.ExecContext(ctx, `UPDATE wallet SET last_sync=$1 WHERE id=$2`, t, id)
	return err
}

func NewPostgresWalletRepository(db *sql.DB) *PostgresWalletRepository {
	return &PostgresWalletRepository{db: db}
}

func (r *PostgresWalletRepository) CreateWallet(ctx context.Context, wallet domain.Wallet) (uuid.UUID, error) {
	query := `
		INSERT INTO wallet (user_id, platform_id, name, api_key, api_secret)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	// El driver de postgres acepta *string: si es nil inserta NULL
	var id uuid.UUID
	err := r.db.QueryRowContext(ctx, query,
		wallet.UserID,
		wallet.PlatformID,
		wallet.Name,
		wallet.APIKey,    // *string → NULL si nil
		wallet.APISecret, // *string → NULL si nil
	).Scan(&id)
	return id, err
}

func (r *PostgresWalletRepository) ReadWallet(ctx context.Context, id uuid.UUID) (domain.Wallet, error) {
	query := `
		SELECT id, user_id, platform_id, name, api_key, api_secret, created_at, last_sync
		FROM wallet
		WHERE id = $1
	`
	var w domain.Wallet
	var lastSync sql.NullTime // last_sync puede ser NULL si nunca se sincronizó
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&w.ID, &w.UserID, &w.PlatformID, &w.Name,
		&w.APIKey,    // *string: el driver pone nil si la columna es NULL
		&w.APISecret, // *string: idem
		&w.CreatedAt,
		&lastSync,
	)
	if lastSync.Valid {
		w.LastSync = lastSync.Time
	}
	return w, err
}

func (r *PostgresWalletRepository) UpdateWallet(ctx context.Context, id uuid.UUID, wallet domain.Wallet) error {
	query := `UPDATE wallet SET name=$1, api_key=$2, api_secret=$3 WHERE id=$4`
	_, err := r.db.ExecContext(ctx, query, wallet.Name, wallet.APIKey, wallet.APISecret, id)
	return err
}

func (r *PostgresWalletRepository) DeleteWallet(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM wallet WHERE id=$1`, id)
	return err
}
