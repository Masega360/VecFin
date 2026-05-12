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
	CreatedAt time.Time `json:"created_at"`
}

// ─── AIProvider ───────────────────────────────────────────────────────────────

// AIProvider es la interfaz abstracta para cualquier proveedor de IA.
// Para agregar Bedrock, OpenAI, etc. basta con implementar esta interfaz.
type AIProvider interface {
	GetRecommendations(ctx context.Context, input RecommendationInput) ([]Recommendation, error)
	// SendMessage envía un mensaje dentro de una conversación multi-turn.
	// history contiene los mensajes previos de la sesión (ordenados por created_at).
	SendMessage(ctx context.Context, history []ChatMessage, userMessage string) (string, error)
}
