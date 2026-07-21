package infrastructure

import (
	"fmt"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type InAppService struct {
	repo domain.InAppNotificationRepository
}

func NewInAppService(repo domain.InAppNotificationRepository) *InAppService {
	return &InAppService{repo: repo}
}

func (s *InAppService) Send(userID uuid.UUID, title, message, link string) error {
	notif := domain.InAppNotification{
		ID:        uuid.New(),
		UserID:    userID,
		Title:     title,
		Message:   message,
		IsRead:    false,
		CreatedAt: time.Now(),
	}
	fmt.Printf("✅ INAPP NOTI. Title: %s\n", title)

	return s.repo.Create(notif)
}
