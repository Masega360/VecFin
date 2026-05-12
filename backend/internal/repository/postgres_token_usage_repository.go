package repository

import (
	"context"
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresTokenUsageRepository struct {
	db *sql.DB
}

func NewPostgresTokenUsageRepository(db *sql.DB) *PostgresTokenUsageRepository {
	return &PostgresTokenUsageRepository{db: db}
}

func (r *PostgresTokenUsageRepository) Record(ctx context.Context, userID uuid.UUID, provider string, inputTokens, outputTokens int, costUSD float64) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO token_usage (user_id, provider, input_tokens, output_tokens, cost_usd) VALUES ($1, $2, $3, $4, $5)`,
		userID, provider, inputTokens, outputTokens, costUSD)
	return err
}

func (r *PostgresTokenUsageRepository) GetMonthly(ctx context.Context, userID uuid.UUID) ([]domain.MonthlyUsage, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT provider, COALESCE(SUM(input_tokens),0), COALESCE(SUM(output_tokens),0), COALESCE(SUM(cost_usd),0)
		 FROM token_usage
		 WHERE user_id = $1 AND created_at >= date_trunc('month', NOW())
		 GROUP BY provider`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var usages []domain.MonthlyUsage
	for rows.Next() {
		var u domain.MonthlyUsage
		if err := rows.Scan(&u.Provider, &u.InputTokens, &u.OutputTokens, &u.TotalCostUSD); err != nil {
			return nil, err
		}
		usages = append(usages, u)
	}
	return usages, rows.Err()
}
