package domain

import (
	"time"

	"github.com/google/uuid"
)

type AssetComment struct {
	ID         uuid.UUID      `json:"id"`
	Symbol     string         `json:"symbol"`
	ParentID   *uuid.UUID     `json:"parent_id,omitempty"`
	AuthorID   uuid.UUID      `json:"author_id"`
	AuthorName string         `json:"author_name,omitempty"`
	Content    string         `json:"content"`
	Likes      int            `json:"likes"`
	UserLiked  bool           `json:"user_liked"`
	Replies    []AssetComment `json:"replies,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
}
