package domain

import (
	"time"

	"github.com/google/uuid"
)

type AlertCondition string

const (
	ConditionAbove AlertCondition = "ABOVE"
	ConditionBelow AlertCondition = "BELOW"
)

type PriceAlert struct {
	ID          uuid.UUID      `json:"id"`
	UserID      uuid.UUID      `json:"user_id"`
	Symbol      string         `json:"symbol"`
	TargetPrice float64        `json:"target_price"`
	Condition   AlertCondition `json:"condition"` // "ABOVE" o "BELOW"
	IsActive    bool           `json:"is_active"`
	CreatedAt   time.Time      `json:"created_at"`
}

type PriceAlertRepository interface {
	Create(alert PriceAlert) error
	GetByUserID(userID uuid.UUID) ([]PriceAlert, error)
	GetActiveAlertsBySymbol(symbol string) ([]PriceAlert, error)
	Deactivate(alertID uuid.UUID) error
	Delete(alertID uuid.UUID) error
}
