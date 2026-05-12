package usecase

import (
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PriceAlertUsecase struct {
	repo domain.PriceAlertRepository
}

func NewPriceAlertUsecase(repo domain.PriceAlertRepository) *PriceAlertUsecase {
	return &PriceAlertUsecase{repo: repo}
}

func (u *PriceAlertUsecase) CreateAlert(userID uuid.UUID, symbol string, targetPrice float64, condition domain.AlertCondition) error {
	if symbol == "" || targetPrice <= 0 {
		return errors.New("símbolo y precio objetivo son obligatorios y deben ser mayores a 0")
	}

	if condition != domain.ConditionAbove && condition != domain.ConditionBelow {
		return errors.New("la condición debe ser 'ABOVE' o 'BELOW'")
	}

	alert := domain.PriceAlert{
		ID:          uuid.New(),
		UserID:      userID,
		Symbol:      symbol,
		TargetPrice: targetPrice,
		Condition:   condition,
		IsActive:    true,
		CreatedAt:   time.Now(),
	}

	return u.repo.Create(alert)
}

func (u *PriceAlertUsecase) GetMyAlerts(userID uuid.UUID) ([]domain.PriceAlert, error) {
	return u.repo.GetByUserID(userID)
}

func (u *PriceAlertUsecase) DeleteAlert(userID uuid.UUID, alertID uuid.UUID) error {
	return u.repo.Delete(alertID, userID)
}
