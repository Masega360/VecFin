package repository

import (
	"database/sql"
	"errors"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresPostRepository struct {
	db *sql.DB
}

func NewPostgresPostRepository(db *sql.DB) *PostgresPostRepository {
	return &PostgresPostRepository{db: db}
}

func (r *PostgresPostRepository) Create(p domain.Post) error {
	query := `
        INSERT INTO posts (id, community_id, parent_id, author_id, title, content, url, upvotes, downvotes, comment_count, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `
	_, err := r.db.Exec(query, p.ID, p.CommunityID, p.ParentID, p.AuthorID, p.Title, p.Content, p.URL, p.Upvotes, p.Downvotes, p.CommentCount, p.CreatedAt, p.UpdatedAt)
	return err
}

func (r *PostgresPostRepository) FindByID(id uuid.UUID) (domain.Post, error) {
	var p domain.Post
	query := `
        SELECT id, community_id, parent_id, author_id, COALESCE(title, ''), content, COALESCE(url, ''), upvotes, downvotes, comment_count, created_at, updated_at
        FROM posts WHERE id = $1
    `
	err := r.db.QueryRow(query, id).Scan(
		&p.ID, &p.CommunityID, &p.ParentID, &p.AuthorID, &p.Title, &p.Content, &p.URL,
		&p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.Post{}, errors.New("Post no encontrado")
		}
		return domain.Post{}, err
	}
	return p, nil
}

func (r *PostgresPostRepository) FindByCommunityID(communityID uuid.UUID) ([]domain.Post, error) {
	var posts []domain.Post
	query := `
        SELECT id, community_id, parent_id, author_id, COALESCE(title, ''), content, COALESCE(url, ''), upvotes, downvotes, comment_count, created_at, updated_at
        FROM posts 
        WHERE community_id = $1 AND parent_id IS NULL
        ORDER BY created_at DESC
    `
	rows, err := r.db.Query(query, communityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p domain.Post
		if err := rows.Scan(
			&p.ID, &p.CommunityID, &p.ParentID, &p.AuthorID, &p.Title, &p.Content, &p.URL,
			&p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, nil
}

func (r *PostgresPostRepository) FindRepliesByPostID(parentID uuid.UUID) ([]domain.Post, error) {
	var replies []domain.Post
	query := `
        SELECT id, community_id, parent_id, author_id, COALESCE(title, ''), content, COALESCE(url, ''), upvotes, downvotes, comment_count, created_at, updated_at
        FROM posts 
        WHERE parent_id = $1
        ORDER BY created_at ASC
    `
	rows, err := r.db.Query(query, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p domain.Post
		if err := rows.Scan(
			&p.ID, &p.CommunityID, &p.ParentID, &p.AuthorID, &p.Title, &p.Content, &p.URL,
			&p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		replies = append(replies, p)
	}
	return replies, nil
}

// busca comentarios originales ya que se pregunta si parent_id es NULL. (No comentarios a posts)
func (r *PostgresPostRepository) SearchPostsInCommunity(communityID uuid.UUID, searchQuery string) ([]domain.Post, error) {
	var posts []domain.Post
	searchTerm := "%" + searchQuery + "%"

	query := `
        SELECT id, community_id, parent_id, author_id, COALESCE(title, ''), content, COALESCE(url, ''), upvotes, downvotes, comment_count, created_at, updated_at
        FROM posts 
        WHERE community_id = $1 AND parent_id IS NULL 
        AND (title ILIKE $2 OR content ILIKE $2)
        ORDER BY created_at DESC
    `
	rows, err := r.db.Query(query, communityID, searchTerm)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var p domain.Post
		if err := rows.Scan(
			&p.ID, &p.CommunityID, &p.ParentID, &p.AuthorID, &p.Title, &p.Content, &p.URL,
			&p.Upvotes, &p.Downvotes, &p.CommentCount, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		posts = append(posts, p)
	}
	return posts, nil
}

func (r *PostgresPostRepository) Update(p domain.Post) error {
	query := `
        UPDATE posts
        SET title = $1, content = $2, url = $3, upvotes = $4, downvotes = $5, comment_count = $6, updated_at = $7
        WHERE id = $8
    `
	_, err := r.db.Exec(query, p.Title, p.Content, p.URL, p.Upvotes, p.Downvotes, p.CommentCount, p.UpdatedAt, p.ID)
	return err
}

func (r *PostgresPostRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM posts WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
