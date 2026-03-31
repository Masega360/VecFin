// backend/internal/domain/asset.go
package domain

// Asset representa un activo financiero en nuestra regla de negocio
type Asset struct {
	Symbol string `json:"symbol"`
	Name   string `json:"name"`
	Type   string `json:"type"`
}

// MarketService define el contrato que debe cumplir cualquier proveedor de mercado (ej. Yahoo)
type MarketService interface {
	SearchAssets(query string) ([]Asset, error)
}
