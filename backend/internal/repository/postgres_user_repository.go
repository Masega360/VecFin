package repository

import (
	"database/sql"
	"errors"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresUserRepository struct {
	db *sql.DB
}

func NewPostgresUserRepository(db *sql.DB) *PostgresUserRepository {
	return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) Save(user domain.User) error {
	query := `
		INSERT INTO users (id, first_name, last_name, email, password_hash, google_id, risk_type, registration_date)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.Exec(query, user.ID, user.FirstName, user.LastName, user.Email, user.PasswordHash, user.GoogleID, user.RiskType, user.RegistrationDate)
	return err
}

func (r *PostgresUserRepository) FindByID(id uuid.UUID) (domain.User, error) {
	var user domain.User
	query := `
		SELECT id, first_name, last_name, email, password_hash, COALESCE(google_id, ''), risk_type, registration_date
		FROM users WHERE id = $1
	`
	err := r.db.QueryRow(query, id).Scan(
		&user.ID, &user.FirstName, &user.LastName, &user.Email,
		&user.PasswordHash, &user.GoogleID, &user.RiskType, &user.RegistrationDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.User{}, errors.New("usuario no encontrado")
		}
		return domain.User{}, err
	}
	return user, nil
}

func (r *PostgresUserRepository) FindByEmail(email string) (domain.User, error) {
	var user domain.User
	query := `
		SELECT id, first_name, last_name, email, password_hash, COALESCE(google_id, ''), risk_type, registration_date
		FROM users WHERE email = $1
	`
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.FirstName, &user.LastName, &user.Email,
		&user.PasswordHash, &user.GoogleID, &user.RiskType, &user.RegistrationDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.User{}, errors.New("usuario no encontrado")
		}
		return domain.User{}, err
	}
	return user, nil
}

func (r *PostgresUserRepository) FindByGoogleID(googleID string) (domain.User, error) {
	var user domain.User
	query := `
		SELECT id, first_name, last_name, email, password_hash, COALESCE(google_id, ''), risk_type, registration_date
		FROM users WHERE google_id = $1
	`
	err := r.db.QueryRow(query, googleID).Scan(
		&user.ID, &user.FirstName, &user.LastName, &user.Email,
		&user.PasswordHash, &user.GoogleID, &user.RiskType, &user.RegistrationDate,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return domain.User{}, errors.New("usuario no encontrado")
		}
		return domain.User{}, err
	}
	return user, nil
}

func (r *PostgresUserRepository) Update(user domain.User) error {
	query := `
		UPDATE users
		SET first_name = $1, last_name = $2, email = $3, risk_type = $4
		WHERE id = $5
	`
	_, err := r.db.Exec(query, user.FirstName, user.LastName, user.Email, user.RiskType, user.ID)
	return err
}

func (r *PostgresUserRepository) Delete(id uuid.UUID) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := r.db.Exec(query, id)
	return err
}
