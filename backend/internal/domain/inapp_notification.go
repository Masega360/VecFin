package domain

import (
	"time"

	"github.com/google/uuid"
)

type InAppNotification struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	IsRead    bool      `json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

type InAppNotificationRepository interface {
	Create(notif InAppNotification) error
	GetByUserID(userID uuid.UUID) ([]InAppNotification, error)
	MarkAsRead(notifID, userID uuid.UUID) error
	GetUnreadCount(userID uuid.UUID) (int, error)
}
