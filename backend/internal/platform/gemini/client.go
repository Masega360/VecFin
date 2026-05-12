package gemini

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"google.golang.org/genai"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

const model = "gemini-2.0-flash-lite"

type Client struct {
	client *genai.Client
}

func NewClient(apiKey string) (*Client, error) {
	c, err := genai.NewClient(context.Background(), &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, err
	}
	return &Client{client: c}, nil
}

// GetRecommendations genera recomendaciones financieras personalizadas.
func (c *Client) GetRecommendations(ctx context.Context, input domain.RecommendationInput) ([]domain.Recommendation, error) {
	result, err := c.client.Models.GenerateContent(ctx, model, genai.Text(buildRecommendationPrompt(input)), nil)
	if err != nil {
		return nil, fmt.Errorf("gemini: %w", err)
	}

	raw := cleanJSON(result.Text())
	var recs []domain.Recommendation
	if err := json.Unmarshal([]byte(raw), &recs); err != nil {
		return nil, fmt.Errorf("gemini: respuesta no parseable: %w", err)
	}
	return recs, nil
}

// SendMessage envía un mensaje en una conversación multi-turn.
func (c *Client) SendMessage(ctx context.Context, history []domain.ChatMessage, userMessage string) (string, error) {
	chat, err := c.client.Chats.Create(ctx, model, &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(
			"Eres un asistente financiero experto. Ayudás al usuario con análisis de mercado, "+
				"estrategias de inversión y consultas sobre sus activos. Respondés en el idioma del usuario.",
			"user",
		),
	}, historyToContents(history))
	if err != nil {
		return "", fmt.Errorf("gemini chat: %w", err)
	}

	result, err := chat.SendMessage(ctx, *genai.NewPartFromText(userMessage))
	if err != nil {
		return "", fmt.Errorf("gemini chat: %w", err)
	}
	return result.Text(), nil
}

// historyToContents convierte el historial de dominio al formato del SDK.
func historyToContents(history []domain.ChatMessage) []*genai.Content {
	contents := make([]*genai.Content, 0, len(history))
	for _, m := range history {
		contents = append(contents, genai.NewContentFromText(m.Content, genai.Role(m.Role)))
	}
	return contents
}

func buildRecommendationPrompt(input domain.RecommendationInput) string {
	return fmt.Sprintf(`Eres un asesor financiero de IA. Basándote en el perfil del usuario, genera exactamente 5 recomendaciones financieras personalizadas.

Perfil de riesgo: %s
Activos en cartera: %s
Temas calientes del mercado: %s

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, con este formato:
[{"title":"...","description":"...","ticker":"...","action":"buy|sell|hold|watch"}]

Las recomendaciones deben ser concretas, accionables y coherentes con el perfil de riesgo.`,
		input.RiskType,
		strings.Join(input.Holdings, ", "),
		strings.Join(input.HotTopics, ", "),
	)
}

func cleanJSON(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}
