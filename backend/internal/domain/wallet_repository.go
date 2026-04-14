package domain

import "github.com/google/uuid"

type WalletRepository interface {
	CreateWallet(wallet Wallet) (uuid.UUID, error)
	ReadWallet(id uuid.UUID) (Wallet, error)
	UpdateWallet(id uuid.UUID, wallet Wallet) error
	DeleteWallet(id uuid.UUID) error
}
