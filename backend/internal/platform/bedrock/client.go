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
const ModelID = "us.anthropic.claude-haiku-4-5-20251001-v1:0"

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
	for i := range recs {
		recs[i].Provider = "bedrock"
	}
	return recs, nil
}

func (c *Client) SendMessage(ctx context.Context, history []domain.ChatMessage, userMessage string, systemContext string, tools domain.ChatToolExecutor) (domain.AIResponse, error) {
	sysInstruction := "Eres un asistente financiero integrado en la plataforma VecFin. " +
		"Tenés acceso a los datos del usuario y podés buscar noticias, precios y activos en tiempo real usando tus herramientas. " +
		"Cuando cites noticias, usá formato markdown: [título](url). " +
		"Usá las herramientas siempre que necesites datos actualizados. " +
		"IMPORTANTE: Cuando uses get_asset_price, el bloque ```asset``` se renderiza visualmente como una tarjeta con precio, gráfico y stats. " +
		"NO repitas el precio, cambio %, high, low ni volumen en texto porque ya se muestra en la tarjeta. Solo agregá tu análisis u opinión. " +
		"Respondés en el idioma del usuario, de forma útil y concreta."
	if systemContext != "" {
		sysInstruction += "\n\nDatos del usuario en la plataforma:\n" + systemContext
	}

	// Build messages
	messages := make([]map[string]any, 0, len(history)+1)
	for _, m := range history {
		role := "user"
		if m.Role == "model" {
			role = "assistant"
		}
		messages = append(messages, map[string]any{"role": role, "content": m.Content})
	}
	messages = append(messages, map[string]any{"role": "user", "content": userMessage})

	toolDefs := []map[string]any{
		{
			"name":        "search_news",
			"description": "Busca noticias financieras recientes sobre un tema, ticker o activo.",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{"query": map[string]any{"type": "string", "description": "Tema o ticker a buscar"}},
				"required":   []string{"query"},
			},
		},
		{
			"name":        "get_asset_price",
			"description": "Obtiene el precio actual y datos de mercado de un activo financiero.",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{"symbol": map[string]any{"type": "string", "description": "Símbolo del activo (ej: BTC-USD, AAPL)"}},
				"required":   []string{"symbol"},
			},
		},
		{
			"name":        "search_assets",
			"description": "Busca activos financieros por nombre o símbolo.",
			"input_schema": map[string]any{
				"type":       "object",
				"properties": map[string]any{"query": map[string]any{"type": "string", "description": "Nombre o símbolo parcial del activo"}},
				"required":   []string{"query"},
			},
		},
	}

	// Tool use loop
	for i := 0; i < 5; i++ {
		body, _ := json.Marshal(map[string]any{
			"anthropic_version": "bedrock-2023-05-31",
			"max_tokens":        2048,
			"system":            sysInstruction,
			"messages":          messages,
			"tools":             toolDefs,
		})

		out, err := c.br.InvokeModel(ctx, &bedrockruntime.InvokeModelInput{
			ModelId:     ptr(ModelID),
			ContentType: ptr("application/json"),
			Body:        body,
		})
		if err != nil {
			return domain.AIResponse{}, fmt.Errorf("bedrock: %w", err)
		}

		var resp struct {
			Content    []json.RawMessage `json:"content"`
			StopReason string            `json:"stop_reason"`
			Usage      struct {
				InputTokens  int `json:"input_tokens"`
				OutputTokens int `json:"output_tokens"`
			} `json:"usage"`
		}
		if err := json.Unmarshal(out.Body, &resp); err != nil {
			return domain.AIResponse{}, fmt.Errorf("bedrock parse: %w", err)
		}

		// Check if we need to handle tool use
		if resp.StopReason != "tool_use" {
			// Extract text from content blocks
			var text strings.Builder
			for _, block := range resp.Content {
				var b struct {
					Type string `json:"type"`
					Text string `json:"text"`
				}
				json.Unmarshal(block, &b)
				if b.Type == "text" {
					text.WriteString(b.Text)
				}
			}
			return domain.AIResponse{
				Content:      text.String(),
				Provider:     "bedrock",
				InputTokens:  resp.Usage.InputTokens,
				OutputTokens: resp.Usage.OutputTokens,
			}, nil
		}

		// Process tool calls
		// Add assistant message with tool_use blocks
		messages = append(messages, map[string]any{"role": "assistant", "content": resp.Content})

		var toolResults []map[string]any
		for _, block := range resp.Content {
			var tc struct {
				Type  string         `json:"type"`
				ID    string         `json:"id"`
				Name  string         `json:"name"`
				Input map[string]any `json:"input"`
			}
			json.Unmarshal(block, &tc)
			if tc.Type != "tool_use" {
				continue
			}

			var output string
			switch tc.Name {
			case "search_news":
				q, _ := tc.Input["query"].(string)
				output = tools.SearchNews(q)
			case "get_asset_price":
				s, _ := tc.Input["symbol"].(string)
				output = tools.GetAssetPrice(s)
			case "search_assets":
				q, _ := tc.Input["query"].(string)
				output = tools.SearchAssets(q)
			}
			toolResults = append(toolResults, map[string]any{
				"type":        "tool_result",
				"tool_use_id": tc.ID,
				"content":     output,
			})
		}
		messages = append(messages, map[string]any{"role": "user", "content": toolResults})
	}

	return domain.AIResponse{Content: "Error: demasiadas llamadas a herramientas", Provider: "bedrock"}, nil
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
