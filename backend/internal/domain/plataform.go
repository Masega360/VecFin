package domain

import (
	"github.com/google/uuid"
)

type Plataform struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
}
