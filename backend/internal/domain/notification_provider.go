package domain

import (
	"github.com/google/uuid"
)

type NotificationProvider interface {
	Send(userID uuid.UUID, title, message string) error
}
