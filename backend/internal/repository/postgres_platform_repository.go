package repository

import (
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type postgresPlatformRepository struct {
	db *sql.DB
}

func NewPostgresPlatformRepository(db *sql.DB) *postgresPlatformRepository {
	return &postgresPlatformRepository{db: db}
}

func (r *postgresPlatformRepository) Search(query string) ([]domain.Platform, error) {
	// Usamos ILIKE para que busque sin importar mayúsculas o minúsculas
	querySQL := `SELECT id, name, description FROM platform WHERE name ILIKE '%' || $1 || '%'`

	rows, err := r.db.Query(querySQL, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var platforms []domain.Platform
	for rows.Next() {
		var p domain.Platform
		if err := rows.Scan(&p.ID, &p.Name, &p.Description); err != nil {
			return nil, err
		}
		platforms = append(platforms, p)
	}

	// Si la base de datos devuelve null, mandamos un slice vacío en vez de null al frontend
	if platforms == nil {
		return []domain.Platform{}, nil
	}

	return platforms, nil
}

func (r *postgresPlatformRepository) GetByID(id string) (*domain.Platform, error) {
	var p domain.Platform
	querySQL := `SELECT id, name, description FROM platform WHERE id = $1`

	err := r.db.QueryRow(querySQL, id).Scan(&p.ID, &p.Name, &p.Description)
	if err != nil {
		return nil, err
	}

	return &p, nil
}
