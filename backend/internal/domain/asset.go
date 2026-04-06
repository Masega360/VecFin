package domain

import (
	"time"

	"github.com/google/uuid"
)

// Asset representa un activo financiero en nuestra regla de negocio
type Asset struct {
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
	Type   string `json:"type"`
}

// FavAsset representa un activo marcado como favorito por un usuario
type FavAsset struct {
	ID        int       `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	AssetID   string    `json:"asset_id"`
	CreatedAt time.Time `json:"created_at"`
}

// OHLCPoint es un punto de precio en el tiempo para el gráfico
type OHLCPoint struct {
	Timestamp int64   `json:"t"`
	Close     float64 `json:"c"`
}

// AssetDetails contiene el precio actual y datos históricos de un activo
type AssetDetails struct {
	Symbol    string      `json:"symbol"`
	Name      string      `json:"name"`
	Currency  string      `json:"currency"`
	Price     float64     `json:"price"`
	Change    float64     `json:"change"`
	ChangePct float64     `json:"change_pct"`
	Open      float64     `json:"open"`
	High      float64     `json:"high"`
	Low       float64     `json:"low"`
	Volume    int64       `json:"volume"`
	MarketCap int64       `json:"market_cap"`
	History   []OHLCPoint `json:"history"`
}

// MarketService define el contrato que debe cumplir cualquier proveedor de mercado (ej. Yahoo)
type MarketService interface {
	SearchAssets(query string) ([]Asset, error)
	GetAssetDetails(symbol, rangeParam string) (*AssetDetails, error)
}

// AssetRepository define el contrato para persistir activos favoritos
type AssetRepository interface {
	AddFavorite(userID uuid.UUID, assetID string) error
	RemoveFavorite(userID uuid.UUID, assetID string) error
	ListFavorites(userID uuid.UUID) ([]FavAsset, error)
}
