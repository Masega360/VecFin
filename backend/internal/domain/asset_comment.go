package domain

import (
	"time"

	"github.com/google/uuid"
)

type AssetComment struct {
	ID         uuid.UUID `json:"id"`
	Symbol     string    `json:"symbol"`
	AuthorID   uuid.UUID `json:"author_id"`
	AuthorName string    `json:"author_name,omitempty"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
}
