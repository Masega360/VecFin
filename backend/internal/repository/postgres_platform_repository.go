package repository

import (
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type PostgresPlatformRepository struct {
	db *sql.DB
}

func NewPostgresPlatformRepository(db *sql.DB) *PostgresPlatformRepository {
	return &PostgresPlatformRepository{db: db}
}

func (r *PostgresPlatformRepository) List() ([]domain.Platform, error) {
	query := `SELECT id, name, description FROM platform`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var platform []domain.Platform
	for rows.Next() {
		var p domain.Platform
		if err := rows.Scan(&p.ID, &p.Name, &p.Description); err != nil {
			return nil, err
		}
		platform = append(platform, p)
	}
	return platform, rows.Err()
}
