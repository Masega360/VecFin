package repository

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresAssetWalletRepository struct {
	db *sql.DB
}

func NewPostgresAssetWalletRepository(db *sql.DB) *PostgresAssetWalletRepository {
	return &PostgresAssetWalletRepository{db: db}
}

// Add inserta una tenencia. Si ya existe (wallet_id, ticker) suma la cantidad.
// Se apoya en la restricción UNIQUE (wallet_id, ticker) de la tabla asset_wallet.
func (r *PostgresAssetWalletRepository) Add(
	ctx context.Context,
	walletID uuid.UUID,
	ticker string,
	quantity float64,
) (domain.AssetWallet, error) {
	ticker = strings.ToUpper(strings.TrimSpace(ticker))
	query := `
		INSERT INTO asset_wallet (wallet_id, ticker, quantity)
		VALUES ($1, $2, $3)
		ON CONFLICT ON CONSTRAINT unique_wallet_ticker
		DO UPDATE SET quantity = asset_wallet.quantity + EXCLUDED.quantity
		RETURNING id, wallet_id, ticker, quantity
	`
	var a domain.AssetWallet
	err := r.db.QueryRowContext(ctx, query, walletID, ticker, quantity).Scan(
		&a.ID, &a.WalletID, &a.Ticker, &a.Quantity,
	)
	return a, err
}

func (r *PostgresAssetWalletRepository) ListByWallet(
	ctx context.Context,
	walletID uuid.UUID,
) ([]domain.AssetWallet, error) {
	query := `
		SELECT id, wallet_id, ticker, quantity
		FROM asset_wallet
		WHERE wallet_id = $1
		ORDER BY ticker ASC
	`
	rows, err := r.db.QueryContext(ctx, query, walletID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []domain.AssetWallet
	for rows.Next() {
		var a domain.AssetWallet
		if err := rows.Scan(&a.ID, &a.WalletID, &a.Ticker, &a.Quantity); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (r *PostgresAssetWalletRepository) GetByWalletAndTicker(
	ctx context.Context,
	walletID uuid.UUID,
	ticker string,
) (domain.AssetWallet, error) {
	ticker = strings.ToUpper(strings.TrimSpace(ticker))
	query := `
		SELECT id, wallet_id, ticker, quantity
		FROM asset_wallet
		WHERE wallet_id = $1 AND ticker = $2
	`
	var a domain.AssetWallet
	err := r.db.QueryRowContext(ctx, query, walletID, ticker).Scan(
		&a.ID, &a.WalletID, &a.Ticker, &a.Quantity,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.AssetWallet{}, domain.ErrNotFound
	}
	return a, err
}

func (r *PostgresAssetWalletRepository) UpdateQuantity(
	ctx context.Context,
	walletID uuid.UUID,
	ticker string,
	quantity float64,
) error {
	ticker = strings.ToUpper(strings.TrimSpace(ticker))
	res, err := r.db.ExecContext(ctx,
		`UPDATE asset_wallet SET quantity = $1 WHERE wallet_id = $2 AND ticker = $3`,
		quantity, walletID, ticker,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *PostgresAssetWalletRepository) Remove(
	ctx context.Context,
	walletID uuid.UUID,
	ticker string,
) error {
	ticker = strings.ToUpper(strings.TrimSpace(ticker))
	res, err := r.db.ExecContext(ctx,
		`DELETE FROM asset_wallet WHERE wallet_id = $1 AND ticker = $2`,
		walletID, ticker,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrNotFound
	}
	return nil
}
