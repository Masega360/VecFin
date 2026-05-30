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

func (r *PostgresAssetCommentRepository) Create(ctx context.Context, symbol string, authorID uuid.UUID, content string, parentID *uuid.UUID) (domain.AssetComment, error) {
	var c domain.AssetComment
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO asset_comments (symbol, author_id, content, parent_id) VALUES ($1, $2, $3, $4)
		 RETURNING id, symbol, author_id, content, COALESCE(likes, 0), created_at`,
		symbol, authorID, content, parentID,
	).Scan(&c.ID, &c.Symbol, &c.AuthorID, &c.Content, &c.Likes, &c.CreatedAt)
	c.ParentID = parentID
	return c, err
}

func (r *PostgresAssetCommentRepository) ListBySymbol(ctx context.Context, symbol string, userID *uuid.UUID) ([]domain.AssetComment, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ac.id, ac.symbol, ac.parent_id, ac.author_id,
		        u.first_name || ' ' || u.last_name, ac.content, COALESCE(ac.likes, 0), ac.created_at,
		        EXISTS(SELECT 1 FROM asset_comment_likes l WHERE l.comment_id = ac.id AND l.user_id = $2)
		 FROM asset_comments ac JOIN users u ON u.id = ac.author_id
		 WHERE ac.symbol = $1 AND ac.parent_id IS NULL
		 ORDER BY ac.created_at DESC LIMIT 50`, symbol, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var comments []domain.AssetComment
	for rows.Next() {
		var c domain.AssetComment
		if err := rows.Scan(&c.ID, &c.Symbol, &c.ParentID, &c.AuthorID, &c.AuthorName, &c.Content, &c.Likes, &c.CreatedAt, &c.UserLiked); err != nil {
			return nil, err
		}
		comments = append(comments, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load replies
	for i := range comments {
		replies, _ := r.getReplies(ctx, comments[i].ID, userID)
		comments[i].Replies = replies
	}
	return comments, nil
}

func (r *PostgresAssetCommentRepository) getReplies(ctx context.Context, parentID uuid.UUID, userID *uuid.UUID) ([]domain.AssetComment, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT ac.id, ac.symbol, ac.parent_id, ac.author_id,
		        u.first_name || ' ' || u.last_name, ac.content, COALESCE(ac.likes, 0), ac.created_at,
		        EXISTS(SELECT 1 FROM asset_comment_likes l WHERE l.comment_id = ac.id AND l.user_id = $2)
		 FROM asset_comments ac JOIN users u ON u.id = ac.author_id
		 WHERE ac.parent_id = $1 ORDER BY ac.created_at ASC`, parentID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var replies []domain.AssetComment
	for rows.Next() {
		var c domain.AssetComment
		if err := rows.Scan(&c.ID, &c.Symbol, &c.ParentID, &c.AuthorID, &c.AuthorName, &c.Content, &c.Likes, &c.CreatedAt, &c.UserLiked); err != nil {
			return nil, err
		}
		replies = append(replies, c)
	}
	return replies, rows.Err()
}

func (r *PostgresAssetCommentRepository) ToggleLike(ctx context.Context, commentID, userID uuid.UUID) (bool, error) {
	var exists bool
	_ = r.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM asset_comment_likes WHERE comment_id=$1 AND user_id=$2)`,
		commentID, userID).Scan(&exists)

	if exists {
		_, err := r.db.ExecContext(ctx, `DELETE FROM asset_comment_likes WHERE comment_id=$1 AND user_id=$2`, commentID, userID)
		if err != nil {
			return false, err
		}
		_, _ = r.db.ExecContext(ctx, `UPDATE asset_comments SET likes = likes - 1 WHERE id = $1`, commentID)
		return false, nil
	}
	_, err := r.db.ExecContext(ctx, `INSERT INTO asset_comment_likes (comment_id, user_id) VALUES ($1, $2)`, commentID, userID)
	if err != nil {
		return false, err
	}
	_, _ = r.db.ExecContext(ctx, `UPDATE asset_comments SET likes = likes + 1 WHERE id = $1`, commentID)
	return true, nil
}
