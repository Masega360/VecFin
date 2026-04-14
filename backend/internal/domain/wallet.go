package domain

import (
	"time"

	"github.com/google/uuid"
)

type Wallet struct {
	ID          uuid.UUID `json:"id"`
	UserID      uuid.UUID `json:"user_id"`
	PlataformID uuid.UUID `json:"plataform_id"`
	Name        string    `json:"name"`
	APIKey      string    `json:"api_key"`
	APISecret   string    `json:"-"` // Oculto al serializar la respuesta HTTP
	CreatedAt   time.Time `json:"created_at"`
	LastSync    time.Time `json:"last_sync"`
}
