package domain

import (
	"github.com/google/uuid"
)

type PlanType string

const (
	TypePlazoFijo PlanType = "plazo_fijo"
	TypeFCI       PlanType = "fci"
)

type FinancialPlan struct {
	ID            uuid.UUID `json:"id"`
	FinancierName string    `json:"financier_name"`
	Name          string    `json:"name"`
	Type          PlanType  `json:"type"`
	TNA           float64   `json:"tna"`      // Tasa Nominal Anual
	MinDays       int       `json:"min_days"` // Días mínimos para invertir (ej: 30 para PF, 1 para FCI)
	MinAmount     float64   `json:"min_amount"`
}

type SimulationRequest struct {
	Amount float64 `json:"amount"`
	Days   int     `json:"days"`
}

type SimulationResult struct {
	Plan           FinancialPlan `json:"plan"`
	InitialAmount  float64       `json:"initial_amount"`
	FinalAmount    float64       `json:"final_amount"`
	InterestEarned float64       `json:"interest_earned"`
}

type SimulatorRepository interface {
	GetActivePlans() ([]FinancialPlan, error)
	// se podrian agregar mas como para el admin
}
