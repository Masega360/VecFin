package repository

import (
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresPriceAlertRepository struct {
	db *sql.DB
}

func NewPostgresPriceAlertRepository(db *sql.DB) *PostgresPriceAlertRepository {
	return &PostgresPriceAlertRepository{db: db}
}

func (r *PostgresPriceAlertRepository) Create(alert domain.PriceAlert) error {
	query := `
       INSERT INTO price_alerts (id, user_id, symbol, target_price, condition, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
    `
	_, err := r.db.Exec(query, alert.ID, alert.UserID, alert.Symbol, alert.TargetPrice, string(alert.Condition), alert.IsActive, alert.CreatedAt)
	return err
}

func (r *PostgresPriceAlertRepository) GetByUserID(userID uuid.UUID) ([]domain.PriceAlert, error) {
	query := `
       SELECT id, user_id, symbol, target_price, condition, is_active, created_at
       FROM price_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC
    `
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []domain.PriceAlert
	for rows.Next() {
		var a domain.PriceAlert
		var conditionStr string

		err := rows.Scan(&a.ID, &a.UserID, &a.Symbol, &a.TargetPrice, &conditionStr, &a.IsActive, &a.CreatedAt)
		if err != nil {
			return nil, err
		}

		a.Condition = domain.AlertCondition(conditionStr)
		alerts = append(alerts, a)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return alerts, nil
}

func (r *PostgresPriceAlertRepository) GetActiveAlertsBySymbol(symbol string) ([]domain.PriceAlert, error) {
	query := `
       SELECT id, user_id, symbol, target_price, condition, is_active, created_at
       FROM price_alerts
       WHERE symbol = $1 AND is_active = true
    `
	rows, err := r.db.Query(query, symbol)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []domain.PriceAlert
	for rows.Next() {
		var a domain.PriceAlert
		var conditionStr string

		err := rows.Scan(&a.ID, &a.UserID, &a.Symbol, &a.TargetPrice, &conditionStr, &a.IsActive, &a.CreatedAt)
		if err != nil {
			return nil, err
		}

		a.Condition = domain.AlertCondition(conditionStr)
		alerts = append(alerts, a)
	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return alerts, nil
}

func (r *PostgresPriceAlertRepository) Deactivate(alertID uuid.UUID) error {
	query := `UPDATE price_alerts SET is_active = false WHERE id = $1`
	_, err := r.db.Exec(query, alertID)
	return err
}

func (r *PostgresPriceAlertRepository) Delete(alertID uuid.UUID, userID uuid.UUID) error {
	// Escudo IDOR: ambas condiciones deben cumplirse para borrar
	query := `DELETE FROM price_alerts WHERE id = $1 AND user_id = $2`
	_, err := r.db.Exec(query, alertID, userID)
	return err
}

func (r *PostgresPriceAlertRepository) GetSymbolsByDistinctActiveAlerts() ([]string, error) {
	query := `SELECT DISTINCT symbol FROM price_alerts WHERE is_active = true;`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var symbols []string
	for rows.Next() {
		var symbol string
		err := rows.Scan(&symbol)
		if err != nil {
			return nil, err
		}
		symbols = append(symbols, symbol)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return symbols, nil
}
