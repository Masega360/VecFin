package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type WalletRepository interface {
	CreateWallet(ctx context.Context, wallet Wallet) (uuid.UUID, error)
	ReadWallet(ctx context.Context, id uuid.UUID) (Wallet, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error)
	UpdateWallet(ctx context.Context, id uuid.UUID, wallet Wallet) error
	UpdateLastSync(ctx context.Context, id uuid.UUID, t time.Time) error
	DeleteWallet(ctx context.Context, id uuid.UUID) error
}
