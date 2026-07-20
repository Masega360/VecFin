package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresBalanceRepository struct {
	db *sql.DB
}

func NewPostgresBalanceRepository(db *sql.DB) *PostgresBalanceRepository {
	return &PostgresBalanceRepository{db: db}
}

func (r *PostgresBalanceRepository) GetOrCreate(ctx context.Context, userID uuid.UUID) (domain.UserBalance, error) {
	var b domain.UserBalance
	err := r.db.QueryRowContext(ctx,
		`SELECT user_id, balance_usd, free_tokens_remaining, updated_at FROM user_balance WHERE user_id = $1`,
		userID).Scan(&b.UserID, &b.BalanceUSD, &b.FreeTokensRemaining, &b.UpdatedAt)

	if errors.Is(err, sql.ErrNoRows) {
		// Crear con defaults
		_, err = r.db.ExecContext(ctx,
			`INSERT INTO user_balance (user_id, balance_usd, free_tokens_remaining) VALUES ($1, 0, $2)`,
			userID, domain.FreeTokensDefault)
		if err != nil {
			return domain.UserBalance{}, err
		}
		return domain.UserBalance{
			UserID:              userID,
			BalanceUSD:          0,
			FreeTokensRemaining: domain.FreeTokensDefault,
			UpdatedAt:           time.Now(),
		}, nil
	}
	return b, err
}

func (r *PostgresBalanceRepository) AddBalance(ctx context.Context, userID uuid.UUID, amountUSD float64) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO user_balance (user_id, balance_usd, free_tokens_remaining, updated_at)
		 VALUES ($1, $2, $3, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET balance_usd = user_balance.balance_usd + $2, updated_at = NOW()`,
		userID, amountUSD, domain.FreeTokensDefault)
	return err
}

func (r *PostgresBalanceRepository) DeductBalance(ctx context.Context, userID uuid.UUID, amountUSD float64) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE user_balance SET balance_usd = balance_usd - $2, updated_at = NOW()
		 WHERE user_id = $1 AND balance_usd >= $2`,
		userID, amountUSD)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("saldo insuficiente")
	}
	return nil
}

func (r *PostgresBalanceRepository) DeductFreeTokens(ctx context.Context, userID uuid.UUID, count int) error {
	result, err := r.db.ExecContext(ctx,
		`UPDATE user_balance SET free_tokens_remaining = free_tokens_remaining - $2, updated_at = NOW()
		 WHERE user_id = $1 AND free_tokens_remaining >= $2`,
		userID, count)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("tokens gratuitos agotados")
	}
	return nil
}

func (r *PostgresBalanceRepository) CreatePayment(ctx context.Context, p domain.PaymentHistory) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO payment_history (id, user_id, mp_preference_id, mp_payment_id, amount_ars, amount_usd, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.ID, p.UserID, p.MPPreferenceID, p.MPPaymentID, p.AmountARS, p.AmountUSD, p.Status)
	return err
}

func (r *PostgresBalanceRepository) UpdatePaymentByMPPayment(ctx context.Context, mpPaymentID string, status domain.PaymentStatus) error {
	now := time.Now()
	_, err := r.db.ExecContext(ctx,
		`UPDATE payment_history SET status = $2, mp_payment_id = $1, paid_at = $3
		 WHERE mp_payment_id = $1`,
		mpPaymentID, status, now)
	return err
}

func (r *PostgresBalanceRepository) GetPaymentByPreference(ctx context.Context, mpPreferenceID string) (domain.PaymentHistory, error) {
	var p domain.PaymentHistory
	var paidAt sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, mp_preference_id, mp_payment_id, amount_ars, amount_usd, status, created_at, paid_at
		 FROM payment_history WHERE mp_preference_id = $1`,
		mpPreferenceID).Scan(&p.ID, &p.UserID, &p.MPPreferenceID, &p.MPPaymentID, &p.AmountARS, &p.AmountUSD, &p.Status, &p.CreatedAt, &paidAt)
	if paidAt.Valid {
		p.PaidAt = &paidAt.Time
	}
	return p, err
}

func (r *PostgresBalanceRepository) GetPaymentByID(ctx context.Context, id uuid.UUID) (domain.PaymentHistory, error) {
	var p domain.PaymentHistory
	var paidAt sql.NullTime
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, mp_preference_id, mp_payment_id, amount_ars, amount_usd, status, created_at, paid_at
		 FROM payment_history WHERE id = $1`,
		id).Scan(&p.ID, &p.UserID, &p.MPPreferenceID, &p.MPPaymentID, &p.AmountARS, &p.AmountUSD, &p.Status, &p.CreatedAt, &paidAt)
	if paidAt.Valid {
		p.PaidAt = &paidAt.Time
	}
	return p, err
}
