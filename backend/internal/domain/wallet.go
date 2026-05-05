package domain

import (
	"time"

	"github.com/google/uuid"
)

type Wallet struct {
	ID         uuid.UUID `json:"id"`
	UserID     uuid.UUID `json:"user_id"`
	PlatformID uuid.UUID `json:"platform_id"`
	Name       string    `json:"name"`
	APIKey     *string   `json:"api_key,omitempty"`
	APISecret  *string   `json:"-"` // Oculto al serializar la respuesta HTTP
	CreatedAt  time.Time `json:"created_at"`
	LastSync   time.Time `json:"last_sync"`
}
