package repository

import (
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresAssetRepository struct {
	db *sql.DB
}

func NewPostgresAssetRepository(db *sql.DB) *PostgresAssetRepository {
	return &PostgresAssetRepository{db: db}
}

func (r *PostgresAssetRepository) AddFavorite(userID uuid.UUID, assetID string) error {
	query := `
		INSERT INTO fav_asset (user_id, asset_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`
	_, err := r.db.Exec(query, userID, assetID)
	return err
}

func (r *PostgresAssetRepository) RemoveFavorite(userID uuid.UUID, assetID string) error {
	query := `DELETE FROM fav_asset WHERE user_id = $1 AND asset_id = $2`
	_, err := r.db.Exec(query, userID, assetID)
	return err
}

func (r *PostgresAssetRepository) ListFavorites(userID uuid.UUID) ([]domain.FavAsset, error) {
	query := `
		SELECT id, user_id, asset_id, created_at
		FROM fav_asset
		WHERE user_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var favs []domain.FavAsset
	for rows.Next() {
		var f domain.FavAsset
		if err := rows.Scan(&f.ID, &f.UserID, &f.AssetID, &f.CreatedAt); err != nil {
			return nil, err
		}
		favs = append(favs, f)
	}
	return favs, rows.Err()
}
