package repository

import (
	"database/sql"
	"errors"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresFollowRepository struct {
	db *sql.DB
}

func NewPostgresFollowRepository(db *sql.DB) *PostgresFollowRepository {
	return &PostgresFollowRepository{db: db}
}

func (r *PostgresFollowRepository) Create(follow domain.FollowRelationship) error {
	query := `
       INSERT INTO follows (follower_id, following_id, status, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (follower_id, following_id) DO NOTHING
    `
	_, err := r.db.Exec(query, follow.FollowerID, follow.FollowingID, follow.Status, follow.CreatedAt)
	return err
}

func (r *PostgresFollowRepository) UpdateStatus(followerID, followingID uuid.UUID, status domain.FollowStatus) error {
	query := `
       UPDATE follows
       SET status = $1, updated_at = NOW()
       WHERE follower_id = $2 AND following_id = $3
    `
	res, err := r.db.Exec(query, status, followerID, followingID)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("relación de seguimiento no encontrada")
	}

	return nil
}

func (r *PostgresFollowRepository) Delete(followerID, followingID uuid.UUID) error {
	query := `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`
	_, err := r.db.Exec(query, followerID, followingID)
	return err
}

func (r *PostgresFollowRepository) CheckStatus(followerID, followingID uuid.UUID) (domain.FollowStatus, error) {
	var status string
	query := `SELECT status FROM follows WHERE follower_id = $1 AND following_id = $2`

	err := r.db.QueryRow(query, followerID, followingID).Scan(&status)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", errors.New("no existe relación de seguimiento")
		}
		return "", err
	}

	return domain.FollowStatus(status), nil
}

func (r *PostgresFollowRepository) GetFollowerIDs(targetID uuid.UUID, status domain.FollowStatus) ([]uuid.UUID, error) {
	query := `
		SELECT follower_id
		FROM follows
		WHERE following_id = $1
		AND status = $2
	`

	rows, err := r.db.Query(query, targetID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID

	for rows.Next() {
		var id uuid.UUID

		if err := rows.Scan(&id); err != nil {
			return nil, err
		}

		ids = append(ids, id)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return ids, nil
}

func (r *PostgresFollowRepository) GetFollowingIDs(
	followerID uuid.UUID,
	status domain.FollowStatus,
) ([]uuid.UUID, error) {

	query := `
		SELECT following_id
		FROM follows
		WHERE follower_id = $1
		AND status = $2
	`

	rows, err := r.db.Query(query, followerID, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID

	for rows.Next() {
		var id uuid.UUID

		if err := rows.Scan(&id); err != nil {
			return nil, err
		}

		ids = append(ids, id)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return ids, nil
}

func (r *PostgresFollowRepository) GetRelationship(followerID, followingID uuid.UUID) (domain.FollowRelationship, error) {
	var follow domain.FollowRelationship
	query := ` SELECT follower_id,
           following_id,
           status,
           created_at,
           updated_at
    FROM follows
    WHERE follower_id = $1 AND following_id = $2`

	err := r.db.QueryRow(query, followerID, followingID).Scan(
		&follow.FollowerID, &follow.FollowingID, &follow.Status, &follow.CreatedAt, &follow.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.FollowRelationship{}, errors.New("no existe relación de seguimiento")
		}
		return domain.FollowRelationship{}, err
	}

	return follow, nil
}
