package repository

import (
	"context"
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresAssetCommentRepository struct {
	db *sql.DB
}

func NewPostgresAssetCommentRepository(db *sql.DB) *PostgresAssetCommentRepository {
	return &PostgresAssetCommentRepository{db: db}
}

func (r *PostgresAssetCommentRepository) Create(ctx context.Context, symbol string, authorID uuid.UUID, content string) (domain.AssetComment, error) {
	var c domain.AssetComment
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO asset_comments (symbol, author_id, content) VALUES ($1, $2, $3)
		 RETURNING id, symbol, author_id, content, created_at`,
		symbol, authorID, content,
	).Scan(&c.ID, &c.Symbol, &c.AuthorID, &c.Content, &c.CreatedAt)
	return c, err
}

func (r *PostgresAssetCommentRepository) ListBySymbol(ctx context.Context, symbol string) ([]domain.AssetComment, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ac.id, ac.symbol, ac.author_id, u.first_name || ' ' || u.last_name, ac.content, ac.created_at
		 FROM asset_comments ac JOIN users u ON u.id = ac.author_id
		 WHERE ac.symbol = $1 ORDER BY ac.created_at DESC LIMIT 50`, symbol)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []domain.AssetComment
	for rows.Next() {
		var c domain.AssetComment
		if err := rows.Scan(&c.ID, &c.Symbol, &c.AuthorID, &c.AuthorName, &c.Content, &c.CreatedAt); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	return comments, rows.Err()
}
