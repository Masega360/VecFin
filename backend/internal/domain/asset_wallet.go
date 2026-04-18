package domain

import (
	"context"

	"github.com/google/uuid"
)

// AssetWallet representa la tenencia de un activo dentro de una wallet.
// Un registro por (wallet_id, ticker) — ver migración 007_asset_wallet.
type AssetWallet struct {
	ID       uuid.UUID `json:"id"`
	WalletID uuid.UUID `json:"wallet_id"`
	Ticker   string    `json:"ticker"`
	Quantity float64   `json:"quantity"`
}

// WalletAssetView enriquece un AssetWallet con datos de mercado en tiempo real.
// Se usa para devolver el detalle de una wallet con valuación.
type WalletAssetView struct {
	Ticker      string  `json:"ticker"`
	Name        string  `json:"name,omitempty"`
	Quantity    float64 `json:"quantity"`
	Price       float64 `json:"price"`
	Currency    string  `json:"currency,omitempty"`
	MarketValue float64 `json:"market_value"` // Quantity * Price
}

// WalletDetails agrega los assets valuados y el total de la wallet.
type WalletDetails struct {
	Wallet     Wallet            `json:"wallet"`
	Assets     []WalletAssetView `json:"assets"`
	TotalValue float64           `json:"total_value"`
	Currency   string            `json:"currency,omitempty"`
}

// AssetWalletRepository define el contrato para persistir tenencias de assets en wallets.
type AssetWalletRepository interface {
	// Add agrega una cantidad de un ticker a una wallet. Si el ticker ya existe
	// en la wallet, la cantidad se SUMA a la existente.
	Add(ctx context.Context, walletID uuid.UUID, ticker string, quantity float64) (AssetWallet, error)

	// ListByWallet devuelve todas las tenencias de una wallet.
	ListByWallet(ctx context.Context, walletID uuid.UUID) ([]AssetWallet, error)

	// GetByWalletAndTicker busca una tenencia específica. Devuelve ErrNotFound si no existe.
	GetByWalletAndTicker(ctx context.Context, walletID uuid.UUID, ticker string) (AssetWallet, error)

	// UpdateQuantity reemplaza la cantidad de un ticker en una wallet.
	UpdateQuantity(ctx context.Context, walletID uuid.UUID, ticker string, quantity float64) error

	// Remove elimina un ticker de una wallet.
	Remove(ctx context.Context, walletID uuid.UUID, ticker string) error
}
