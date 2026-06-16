package repository

import (
	"database/sql"
	"errors"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type PostgresUserRepository struct {
	db *sql.DB
}

func NewPostgresUserRepository(db *sql.DB) *PostgresUserRepository {
	return &PostgresUserRepository{db: db}
}

func (r *PostgresUserRepository) Save(user domain.User) error {
	query := `
		INSERT INTO users (id, first_name, last_name, email, password_hash, google_id, risk_type, registration_date, is_private, show_wallets, show_communities, show_posts)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`
	_, err := r.db.Exec(query, user.ID, user.FirstName, user.LastName, user.Email, user.PasswordHash, user.GoogleID, user.RiskType, user.RegistrationDate, user.Privacy.IsPrivate, user.Privacy.ShowWallets, user.Privacy.ShowCommunities, user.Privacy.ShowCommunityPosts)
	return err
}

func (r *PostgresUserRepository) FindByID(id uuid.UUID) (domain.User, error) {
	var user domain.User
	query := `
		SELECT id, first_name, last_name, email, password_hash, COALESCE(google_id, ''), risk_type, registration_date, is_private, show_wallets, show_communities, show_posts
		FROM users WHERE id = $1 AND deleted_at IS NULL
	`
	err := r.db.QueryRow(query, id).Scan(
		&user.ID, &user.FirstName, &user.LastName, &user.Email,
		&user.PasswordHash, &user.GoogleID, &user.RiskType, &user.RegistrationDate,
		&user.Privacy.IsPrivate, &user.Privacy.ShowWallets, &user.Privacy.ShowCommunities, &user.Privacy.ShowCommunityPosts,
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
		SELECT id, first_name, last_name, email, password_hash, COALESCE(google_id, ''), risk_type, registration_date, is_private, show_wallets, show_communities, show_posts
		FROM users WHERE email = $1 AND deleted_at IS NULL
	`
	err := r.db.QueryRow(query, email).Scan(
		&user.ID, &user.FirstName, &user.LastName, &user.Email,
		&user.PasswordHash, &user.GoogleID, &user.RiskType, &user.RegistrationDate,
		&user.Privacy.IsPrivate, &user.Privacy.ShowWallets, &user.Privacy.ShowCommunities, &user.Privacy.ShowCommunityPosts,
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
		SELECT id, first_name, last_name, email, password_hash, COALESCE(google_id, ''), risk_type, registration_date, is_private, show_wallets, show_communities, show_posts
		FROM users WHERE google_id = $1 AND deleted_at IS NULL
	`
	err := r.db.QueryRow(query, googleID).Scan(
		&user.ID, &user.FirstName, &user.LastName, &user.Email,
		&user.PasswordHash, &user.GoogleID, &user.RiskType, &user.RegistrationDate,
		&user.Privacy.IsPrivate, &user.Privacy.ShowWallets, &user.Privacy.ShowCommunities, &user.Privacy.ShowCommunityPosts,
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
		SET first_name = $1, last_name = $2, email = $3, risk_type = $4, google_id = $5, is_private = $6, show_wallets = $7, show_communities = $8, show_posts = $9
		WHERE id = $10
	`
	_, err := r.db.Exec(query, user.FirstName, user.LastName, user.Email, user.RiskType, user.GoogleID, user.Privacy.IsPrivate, user.Privacy.ShowWallets, user.Privacy.ShowCommunities, user.Privacy.ShowCommunityPosts, user.ID)
	return err
}

func (r *PostgresUserRepository) Delete(id uuid.UUID) error {
	query := `
        UPDATE users 
        SET deleted_at = NOW(),
            first_name = 'Usuario',
            last_name = 'Eliminado',
            email = id::text || '@deleted.vecfin',
            password_hash = 'deleted',
            google_id = NULL
        WHERE id = $1 AND deleted_at IS NULL
    `
	_, err := r.db.Exec(query, id)
	return err
}

func (r *PostgresUserRepository) FindManyByIDs(ids []uuid.UUID) ([]domain.User, error) {
	if len(ids) == 0 {
		return []domain.User{}, nil
	}

	query := `
		SELECT
			id,
			first_name,
			last_name,
			email,
			password_hash,
			COALESCE(google_id, ''),
			risk_type,
			registration_date,
			is_private,
			show_wallets,
			show_communities,
			show_posts
		FROM users
		WHERE id = ANY($1) AND deleted_at IS NULL
	`

	stringIDs := make([]string, len(ids))

	for i, id := range ids {
		stringIDs[i] = id.String()
	}

	rows, err := r.db.Query(query, pq.Array(stringIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []domain.User

	for rows.Next() {
		var user domain.User

		err := rows.Scan(
			&user.ID,
			&user.FirstName,
			&user.LastName,
			&user.Email,
			&user.PasswordHash,
			&user.GoogleID,
			&user.RiskType,
			&user.RegistrationDate,
			&user.Privacy.IsPrivate,
			&user.Privacy.ShowWallets,
			&user.Privacy.ShowCommunities,
			&user.Privacy.ShowCommunityPosts,
		)

		if err != nil {
			return nil, err
		}

		users = append(users, user)
	}

	return users, rows.Err()
}

func (r *PostgresUserRepository) UpdateProfile(id uuid.UUID, firstName, lastName, email string) error {
	query := `UPDATE users SET first_name = $1, last_name = $2, email = $3 WHERE id = $4`
	_, err := r.db.Exec(query, firstName, lastName, email, id)
	return err
}

func (r *PostgresUserRepository) UpdatePrivacy(id uuid.UUID, p domain.PrivacySettings) error {
	query := `UPDATE users SET is_private = $1, show_wallets = $2, show_communities = $3, show_posts = $4 WHERE id = $5`
	_, err := r.db.Exec(query, p.IsPrivate, p.ShowWallets, p.ShowCommunities, p.ShowCommunityPosts, id)
	return err
}

// Search busca en la base de datos usando ILIKE para coincidencias insensibles a mayúsculas/minúsculas
func (r *PostgresUserRepository) Search(query string) ([]domain.User, error) {
	// Preparamos el patrón de búsqueda para que busque en cualquier parte del texto
	searchPattern := "%" + query + "%"

	sqlQuery := `
        SELECT 
            id, first_name, last_name, email, password_hash, COALESCE(google_id, ''), 
            risk_type, registration_date, is_private, show_wallets, show_communities, show_posts
        FROM users 
        WHERE (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1)
          AND deleted_at IS NULL
        LIMIT 50
    `

	rows, err := r.db.Query(sqlQuery, searchPattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []domain.User

	for rows.Next() {
		var user domain.User

		err := rows.Scan(
			&user.ID,
			&user.FirstName,
			&user.LastName,
			&user.Email,
			&user.PasswordHash,
			&user.GoogleID,
			&user.RiskType,
			&user.RegistrationDate,
			&user.Privacy.IsPrivate,
			&user.Privacy.ShowWallets,
			&user.Privacy.ShowCommunities,
			&user.Privacy.ShowCommunityPosts,
		)

		if err != nil {
			return nil, err
		}

		users = append(users, user)
	}

	return users, rows.Err()
}
