package repository

import "database/sql"
import "github.com/Masega360/vecfin/internal/domain"
import "github.com/google/uuid"

type PostgresUserRepository struct {
	db *sql.DB
}

func (r *PostgresUserRepository) Create(user domain.User) error {
	_, err := r.db.Exec(
		"INSERT INTO users (id, first_name, last_name, email, password_hash, risk_type) VALUES ($1, $2, $3, $4, $5, $6)",
		user.ID,
		user.FirstName,
		user.LastName,
		user.Email,
		user.PasswordHash,
		user.RiskType,
	)
	return err
}

func (r *PostgresUserRepository) Read(id uuid.UUID) (domain.User, error) {
	_, err := r.db.Exec(
		"SELECT * FROM users WHERE id = $1",
		id,
	)
	return domain.User{}, err
}

func (r *PostgresUserRepository) Update(id uuid.UUID, user domain.User) error {
	// Implementation for updating a user in PostgreSQL
	_, err := r.db.Exec(
		"UPDATE users SET first_name = $2, last_name = $3, email = $4, password_hash = $5, risk_type = $6 WHERE id = $1",
		id,
		user.FirstName,
		user.LastName,
		user.Email,
		user.PasswordHash,
		user.RiskType,
	)
	return err
}

func (r *PostgresUserRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec(
		"DELETE FROM users WHERE id = $1",
		id,
	)
	return err
}
