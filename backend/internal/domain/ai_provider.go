package domain

import "context"

// RecommendationInput es el contexto que se le pasa al proveedor de IA.
type RecommendationInput struct {
	RiskType  string   // ej: "conservative", "moderate", "aggressive"
	Holdings  []string // tickers que el usuario tiene en sus wallets
	HotTopics []string // temas/activos trending del mercado
}

// Recommendation es una recomendación generada por la IA.
type Recommendation struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Ticker      string `json:"ticker,omitempty"`
	Action      string `json:"action,omitempty"` // "buy", "sell", "hold", "watch"
}

// AIProvider es la interfaz abstracta para cualquier proveedor de IA.
// Para agregar un nuevo proveedor (Bedrock, OpenAI, etc.) basta con implementar esta interfaz.
type AIProvider interface {
	GetRecommendations(ctx context.Context, input RecommendationInput) ([]Recommendation, error)
}
