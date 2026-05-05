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

func (r *PostgresPostRepository) FindByCommunityID(communityID, readerID uuid.UUID) ([]domain.PostResponse, error) {
	query := `
        SELECT p.id, p.community_id, p.parent_id, p.author_id, p.title, p.content, p.url,
               p.upvotes, p.downvotes, p.comment_count, p.created_at, p.updated_at,
               (u.first_name || ' ' || u.last_name) AS author_name,
               pv.is_upvote AS user_vote
        FROM posts p
        INNER JOIN users u ON p.author_id = u.id
        LEFT JOIN post_votes pv ON pv.post_id = p.id AND pv.user_id = $2
        WHERE p.community_id = $1 AND p.parent_id IS NULL
        ORDER BY p.created_at DESC
    `

	rows, err := r.db.Query(query, communityID, readerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []domain.PostResponse
	for rows.Next() {
		var pr domain.PostResponse

		err := rows.Scan(
			&pr.ID, &pr.CommunityID, &pr.ParentID, &pr.AuthorID,
			&pr.Title, &pr.Content, &pr.URL,
			&pr.Upvotes, &pr.Downvotes, &pr.CommentCount,
			&pr.CreatedAt, &pr.UpdatedAt,
			&pr.AuthorName,
			&pr.UserVote,
		)
		if err != nil {
			return nil, err
		}
		posts = append(posts, pr)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return posts, nil
}

func (r *PostgresPostRepository) FindRepliesByPostID(parentID, readerID uuid.UUID) ([]domain.PostResponse, error) {
	var replies []domain.PostResponse

	query := `
        SELECT p.id, p.community_id, p.parent_id, p.author_id,
               COALESCE(p.title, ''), p.content, COALESCE(p.url, ''),
               p.upvotes, p.downvotes, p.comment_count, p.created_at, p.updated_at,
               (u.first_name || ' ' || u.last_name) AS author_name,
               pv.is_upvote AS user_vote
        FROM posts p
        INNER JOIN users u ON p.author_id = u.id
        LEFT JOIN post_votes pv ON pv.post_id = p.id AND pv.user_id = $2
        WHERE p.parent_id = $1
        ORDER BY p.created_at ASC
    `
	rows, err := r.db.Query(query, parentID, readerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pr domain.PostResponse
		if err := rows.Scan(
			&pr.ID, &pr.CommunityID, &pr.ParentID, &pr.AuthorID, &pr.Title, &pr.Content, &pr.URL,
			&pr.Upvotes, &pr.Downvotes, &pr.CommentCount, &pr.CreatedAt, &pr.UpdatedAt,
			&pr.AuthorName,
			&pr.UserVote,
		); err != nil {
			return nil, err
		}
		replies = append(replies, pr)
	}
	return replies, nil
}

// busca comentarios originales ya que se pregunta si parent_id es NULL. (No comentarios a posts)
func (r *PostgresPostRepository) SearchPostsInCommunity(communityID uuid.UUID, searchQuery string) ([]domain.PostResponse, error) {
	var posts []domain.PostResponse
	searchTerm := "%" + searchQuery + "%"

	query := `
        SELECT p.id, p.community_id, p.parent_id, p.author_id, COALESCE(p.title, ''), p.content, COALESCE(p.url, ''), p.upvotes, p.downvotes, p.comment_count, p.created_at, p.updated_at,
               (u.first_name || ' ' || u.last_name) AS author_name
        FROM posts p
        INNER JOIN users u ON p.author_id = u.id
        WHERE p.community_id = $1 AND p.parent_id IS NULL 
        AND (p.title ILIKE $2 OR p.content ILIKE $2)
        ORDER BY p.created_at DESC
    `

	rows, err := r.db.Query(query, communityID, searchTerm)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var pr domain.PostResponse
		if err := rows.Scan(
			&pr.ID, &pr.CommunityID, &pr.ParentID, &pr.AuthorID, &pr.Title, &pr.Content, &pr.URL,
			&pr.Upvotes, &pr.Downvotes, &pr.CommentCount, &pr.CreatedAt, &pr.UpdatedAt,
			&pr.AuthorName,
		); err != nil {
			return nil, err
		}
		posts = append(posts, pr)
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

func (r *PostgresPostRepository) FindVote(postID, userID uuid.UUID) (domain.PostVote, error) {
	var v domain.PostVote
	err := r.db.QueryRow(
		`SELECT post_id, user_id, is_upvote FROM post_votes WHERE post_id = $1 AND user_id = $2`,
		postID, userID,
	).Scan(&v.PostID, &v.UserID, &v.IsUpvote)
	if err == sql.ErrNoRows {
		return domain.PostVote{}, errors.New("no vote")
	}
	return v, err
}

func (r *PostgresPostRepository) UpsertVote(v domain.PostVote) error {
	_, err := r.db.Exec(`
        INSERT INTO post_votes (post_id, user_id, is_upvote)
        VALUES ($1, $2, $3)
        ON CONFLICT (post_id, user_id) DO UPDATE SET is_upvote = $3
    `, v.PostID, v.UserID, v.IsUpvote)
	return err
}

func (r *PostgresPostRepository) DeleteVote(postID, userID uuid.UUID) error {
	_, err := r.db.Exec(
		`DELETE FROM post_votes WHERE post_id = $1 AND user_id = $2`,
		postID, userID,
	)
	return err
}
