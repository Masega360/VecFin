package domain

import (
	"context"
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

type WalletRepository interface {
	CreateWallet(ctx context.Context, wallet Wallet) (uuid.UUID, error)
	ReadWallet(ctx context.Context, id uuid.UUID) (Wallet, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error)
	UpdateWallet(ctx context.Context, id uuid.UUID, wallet Wallet) error
	UpdateLastSync(ctx context.Context, id uuid.UUID, t time.Time) error
	DeleteWallet(ctx context.Context, id uuid.UUID) error
}
