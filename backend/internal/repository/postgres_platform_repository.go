package repository

import (
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type PostgresPlataformRepository struct {
	db *sql.DB
}

func NewPostgresPlataformRepository(db *sql.DB) *PostgresPlataformRepository {
	return &PostgresPlataformRepository{db: db}
}

func (r *PostgresPlataformRepository) List() ([]domain.Plataform, error) {
	query := `SELECT id, name, description FROM plataforms`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var plataforms []domain.Plataform
	for rows.Next() {
		var p domain.Plataform
		if err := rows.Scan(&p.ID, &p.Name, &p.Description); err != nil {
			return nil, err
		}
		plataforms = append(plataforms, p)
	}
	return plataforms, rows.Err()
}
