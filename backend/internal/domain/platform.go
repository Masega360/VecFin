package domain

import (
	"github.com/google/uuid"
)

type Platform struct {
	ID             uuid.UUID `json:"id"`
	Name           string    `json:"name"`
	Description    string    `json:"description"`
	SyncSupported  bool      `json:"sync_supported"`
}
