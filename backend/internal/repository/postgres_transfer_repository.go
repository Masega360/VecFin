package repository

import (
	"context"
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresTransferRepository struct{ db *sql.DB }

func NewPostgresTransferRepository(db *sql.DB) *PostgresTransferRepository {
	return &PostgresTransferRepository{db: db}
}

func (r *PostgresTransferRepository) Create(ctx context.Context, t domain.Transfer) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO transfer (from_wallet_id, to_wallet_id, ticker, quantity, note, created_by)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		t.FromWalletID, t.ToWalletID, t.Ticker, t.Quantity, t.Note, t.CreatedBy).Scan(&id)
	return id, err
}

func (r *PostgresTransferRepository) ListByWallet(ctx context.Context, walletID uuid.UUID) ([]domain.Transfer, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, from_wallet_id, to_wallet_id, ticker, quantity, note, created_by, created_at
		FROM transfer WHERE from_wallet_id = $1 OR to_wallet_id = $1
		ORDER BY created_at DESC`, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var transfers []domain.Transfer
	for rows.Next() {
		var t domain.Transfer
		var note sql.NullString
		if err := rows.Scan(&t.ID, &t.FromWalletID, &t.ToWalletID, &t.Ticker, &t.Quantity, &note, &t.CreatedBy, &t.CreatedAt); err != nil {
			return nil, err
		}
		if note.Valid {
			t.Note = note.String
		}
		transfers = append(transfers, t)
	}
	return transfers, rows.Err()
}
