package usecase

import (
	"errors"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type SimulatorUsecase struct {
	repo domain.SimulatorRepository
}

func NewSimulatorUsecase(repo domain.SimulatorRepository) *SimulatorUsecase {
	return &SimulatorUsecase{repo: repo}
}

func (u *SimulatorUsecase) SimulateInvestments(amount float64, days int) ([]domain.SimulationResult, error) {
	if amount <= 0 {
		return nil, errors.New("el monto debe ser mayor a 0")
	}
	if days <= 0 {
		return nil, errors.New("el período debe ser de al menos 1 día")
	}

	plans, err := u.repo.GetActivePlans()
	if err != nil {
		return nil, err
	}

	var results []domain.SimulationResult

	for _, plan := range plans {
		if amount < plan.MinAmount || days < plan.MinDays {
			continue
		}

		tnaDecimal := plan.TNA / 100.0
		interest := amount * tnaDecimal * (float64(days) / 365.0)
		finalAmount := amount + interest

		results = append(results, domain.SimulationResult{
			Plan:           plan,
			InitialAmount:  amount,
			FinalAmount:    finalAmount,
			InterestEarned: interest,
		})
	}
	return results, nil
}
