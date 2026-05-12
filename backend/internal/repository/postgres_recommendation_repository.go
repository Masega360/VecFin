package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresRecommendationRepository struct {
	db *sql.DB
}

func NewPostgresRecommendationRepository(db *sql.DB) *PostgresRecommendationRepository {
	return &PostgresRecommendationRepository{db: db}
}

func (r *PostgresRecommendationRepository) Get(ctx context.Context, userID uuid.UUID) (*domain.RecommendationCache, error) {
	var raw []byte
	var updatedAt time.Time
	err := r.db.QueryRowContext(ctx,
		`SELECT data, updated_at FROM ai_recommendations_cache WHERE user_id = $1`, userID,
	).Scan(&raw, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var recs []domain.Recommendation
	if err := json.Unmarshal(raw, &recs); err != nil {
		return nil, err
	}
	return &domain.RecommendationCache{UserID: userID, Data: recs, UpdatedAt: updatedAt}, nil
}

func (r *PostgresRecommendationRepository) Upsert(ctx context.Context, cache domain.RecommendationCache) error {
	raw, err := json.Marshal(cache.Data)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`INSERT INTO ai_recommendations_cache (user_id, data, updated_at)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = NOW()`,
		cache.UserID, raw,
	)
	return err
}
