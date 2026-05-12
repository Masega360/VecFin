package bedrock

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

// ModelID puede cambiarse a cualquier modelo de Bedrock con una línea.
const ModelID = "us.anthropic.claude-3-5-haiku-20241022-v1:0"

type Client struct {
	br *bedrockruntime.Client
}

func NewClient(ctx context.Context, region string) (*Client, error) {
	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, err
	}
	return &Client{br: bedrockruntime.NewFromConfig(cfg)}, nil
}

// ─── AIProvider impl ──────────────────────────────────────────────────────────

func (c *Client) GetRecommendations(ctx context.Context, input domain.RecommendationInput) ([]domain.Recommendation, error) {
	prompt := fmt.Sprintf(`Eres un asesor financiero de IA. Basándote en el perfil del usuario, genera exactamente 5 recomendaciones financieras personalizadas.

Perfil de riesgo: %s
Activos en cartera: %s
Temas calientes del mercado: %s

Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, con este formato:
[{"title":"...","description":"...","ticker":"...","action":"buy|sell|hold|watch"}]`,
		input.RiskType,
		strings.Join(input.Holdings, ", "),
		strings.Join(input.HotTopics, ", "),
	)

	raw, err := c.invoke(ctx, prompt)
	if err != nil {
		return nil, err
	}
	raw = cleanJSON(raw)
	var recs []domain.Recommendation
	if err := json.Unmarshal([]byte(raw), &recs); err != nil {
		return nil, fmt.Errorf("bedrock: respuesta no parseable: %w", err)
	}
	return recs, nil
}

func (c *Client) SendMessage(ctx context.Context, history []domain.ChatMessage, userMessage string) (string, error) {
	// Construir historial como texto para el prompt
	var sb strings.Builder
	sb.WriteString("Eres un asistente financiero experto. Respondés en el idioma del usuario.\n\n")
	for _, m := range history {
		role := "Usuario"
		if m.Role == "model" {
			role = "Asistente"
		}
		fmt.Fprintf(&sb, "%s: %s\n", role, m.Content)
	}
	fmt.Fprintf(&sb, "Usuario: %s\nAsistente:", userMessage)

	return c.invoke(ctx, sb.String())
}

// invoke llama a Bedrock con la API de Converse (compatible con todos los modelos).
func (c *Client) invoke(ctx context.Context, prompt string) (string, error) {
	body, _ := json.Marshal(map[string]any{
		"anthropic_version": "bedrock-2023-05-31",
		"max_tokens":        1024,
		"messages": []map[string]any{
			{"role": "user", "content": prompt},
		},
	})

	out, err := c.br.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
		ModelId:     ptr(ModelID),
		ContentType: ptr("application/json"),
		Body:        body,
	})
	if err != nil {
		return "", fmt.Errorf("bedrock: %w", err)
	}

	var resp struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(out.Body, &resp); err != nil {
		return "", fmt.Errorf("bedrock: parse response: %w", err)
	}
	if len(resp.Content) == 0 {
		return "", fmt.Errorf("bedrock: respuesta vacía")
	}
	return resp.Content[0].Text, nil
}

func cleanJSON(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}

func ptr[T any](v T) *T { return &v }
