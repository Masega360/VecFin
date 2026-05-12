package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ─── Recommendations ─────────────────────────────────────────────────────────

type RecommendationInput struct {
	RiskType  string
	Holdings  []string
	HotTopics []string
}

type Recommendation struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Ticker      string `json:"ticker,omitempty"`
	Action      string `json:"action,omitempty"` // buy | sell | hold | watch
	Provider    string `json:"provider,omitempty"`
}

// AIResponse es la respuesta de un mensaje de chat con metadata del provider.
type AIResponse struct {
	Content  string
	Provider string // "gemini" | "bedrock"
}

// RecommendationCache es la fila que se persiste en DB.
type RecommendationCache struct {
	UserID    uuid.UUID
	Data      []Recommendation
	UpdatedAt time.Time
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

type ChatSession struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatMessage struct {
	ID        uuid.UUID `json:"id"`
	SessionID uuid.UUID `json:"session_id"`
	Role      string    `json:"role"` // "user" | "model"
	Content   string    `json:"content"`
	Provider  string    `json:"provider,omitempty"` // solo en respuestas del modelo
	CreatedAt time.Time `json:"created_at"`
}

// ─── AIProvider ───────────────────────────────────────────────────────────────

// AIProvider es la interfaz abstracta para cualquier proveedor de IA.
// Para agregar Bedrock, OpenAI, etc. basta con implementar esta interfaz.
type AIProvider interface {
	GetRecommendations(ctx context.Context, input RecommendationInput) ([]Recommendation, error)
	SendMessage(ctx context.Context, history []ChatMessage, userMessage string, systemContext string) (AIResponse, error)
}
