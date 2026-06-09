package domain

import (
	"github.com/google/uuid"
)

type Platform struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	SyncSupported bool      `json:"sync_supported"`
}

type PlatformRepository interface {
	GetAll() ([]Platform, error)
	Search(query string) ([]Platform, error)
	GetByID(id string) (*Platform, error)
}
