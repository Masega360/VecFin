package usecase

import (
	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type InAppNotificationUsecase struct {
	repo domain.InAppNotificationRepository
}

func NewInAppNotificationUsecase(repo domain.InAppNotificationRepository) *InAppNotificationUsecase {
	return &InAppNotificationUsecase{repo: repo}
}

func (uc *InAppNotificationUsecase) GetMyNotifications(userID uuid.UUID) ([]domain.InAppNotification, error) {
	return uc.repo.GetByUserID(userID)
}

func (uc *InAppNotificationUsecase) MarkAsRead(notifID, userID uuid.UUID) error {
	return uc.repo.MarkAsRead(notifID, userID)
}

func (uc *InAppNotificationUsecase) GetUnreadCount(userID uuid.UUID) (int, error) {
	return uc.repo.GetUnreadCount(userID)
}
