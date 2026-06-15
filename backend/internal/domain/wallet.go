package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Wallet struct {
	ID         uuid.UUID `json:"id"`
	CreatorID  uuid.UUID `json:"creator_id"`
	PlatformID uuid.UUID `json:"platform_id"`
	Name       string    `json:"name"`
	APIKey     *string   `json:"api_key,omitempty"`
	APISecret  *string   `json:"-"`
	CreatedAt  time.Time `json:"created_at"`
	LastSync   time.Time `json:"last_sync"`
}

type WalletRole string

const (
	WalletRoleOwner  WalletRole = "owner"
	WalletRoleAdmin  WalletRole = "admin"
	WalletRoleViewer WalletRole = "viewer"
)

type WalletMember struct {
	WalletID uuid.UUID  `json:"wallet_id"`
	UserID   uuid.UUID  `json:"user_id"`
	Role     WalletRole `json:"role"`
	JoinedAt time.Time  `json:"joined_at"`
}

type CommunityWallet struct {
	CommunityID uuid.UUID `json:"community_id"`
	WalletID    uuid.UUID `json:"wallet_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type Transfer struct {
	ID           uuid.UUID `json:"id"`
	FromWalletID uuid.UUID `json:"from_wallet_id"`
	ToWalletID   uuid.UUID `json:"to_wallet_id"`
	Ticker       string    `json:"ticker"`
	Quantity     float64   `json:"quantity"`
	Note         string    `json:"note,omitempty"`
	CreatedBy    uuid.UUID `json:"created_by"`
	CreatedAt    time.Time `json:"created_at"`
}

// CanOperate indica si el rol puede mover assets (owner o admin)
func (r WalletRole) CanOperate() bool {
	return r == WalletRoleOwner || r == WalletRoleAdmin
}

type WalletRepository interface {
	CreateWallet(ctx context.Context, wallet Wallet) (uuid.UUID, error)
	ReadWallet(ctx context.Context, id uuid.UUID) (Wallet, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error)
	UpdateWallet(ctx context.Context, id uuid.UUID, wallet Wallet) error
	UpdateLastSync(ctx context.Context, id uuid.UUID, t time.Time) error
	DeleteWallet(ctx context.Context, id uuid.UUID) error
}

type WalletMemberRepository interface {
	Add(ctx context.Context, m WalletMember) error
	Remove(ctx context.Context, walletID, userID uuid.UUID) error
	GetRole(ctx context.Context, walletID, userID uuid.UUID) (WalletRole, error)
	ListMembers(ctx context.Context, walletID uuid.UUID) ([]WalletMember, error)
	ListWalletsByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error)
}

type CommunityWalletRepository interface {
	Link(ctx context.Context, communityID, walletID uuid.UUID) error
	Unlink(ctx context.Context, communityID, walletID uuid.UUID) error
	ListByCommunity(ctx context.Context, communityID uuid.UUID) ([]Wallet, error)
}

type TransferRepository interface {
	Create(ctx context.Context, t Transfer) (uuid.UUID, error)
	ListByWallet(ctx context.Context, walletID uuid.UUID) ([]Transfer, error)
}
