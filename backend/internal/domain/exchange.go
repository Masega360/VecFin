package domain

// ExchangeHolding representa la tenencia de un activo en un exchange externo.
type ExchangeHolding struct {
	Ticker   string
	Quantity float64
}

// ExchangeService define el contrato para obtener el portfolio de un usuario
// desde un exchange externo (ej. Binance, Coinbase).
type ExchangeService interface {
	GetHoldings(apiKey, apiSecret string) ([]ExchangeHolding, error)
}
