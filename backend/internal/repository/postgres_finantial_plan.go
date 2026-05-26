package repository

import (
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type PostgresSimulatorRepository struct {
	db *sql.DB
}

func NewPostgresSimulatorRepository(db *sql.DB) *PostgresSimulatorRepository {
	return &PostgresSimulatorRepository{db: db}
}

func (r *PostgresSimulatorRepository) GetActivePlans() ([]domain.FinancialPlan, error) {
	query := `
		SELECT id, financier_name, name, type, tna, min_days, min_amount 
		FROM financial_plans 
		ORDER BY tna DESC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var plans []domain.FinancialPlan
	for rows.Next() {
		var p domain.FinancialPlan
		if err := rows.Scan(&p.ID, &p.FinancierName, &p.Name, &p.Type, &p.TNA, &p.MinDays, &p.MinAmount); err != nil {
			return nil, err
		}
		plans = append(plans, p)
	}

	return plans, nil
}
