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
	for i := range recs {
		recs[i].Provider = "gemini"
	}
	return recs, nil
}

// SendMessage envía un mensaje en una conversación multi-turn.
// chatTools defines the function declarations for the AI.
var chatTools = []*genai.Tool{{
	FunctionDeclarations: []*genai.FunctionDeclaration{
		{
			Name:        "search_news",
			Description: "Busca noticias financieras recientes sobre un tema, ticker o activo. Devuelve títulos y URLs.",
			Parameters: &genai.Schema{
				Type: "OBJECT",
				Properties: map[string]*genai.Schema{
					"query": {Type: "STRING", Description: "Tema o ticker a buscar (ej: Bitcoin, AAPL, inflación)"},
				},
				Required: []string{"query"},
			},
		},
		{
			Name:        "get_asset_price",
			Description: "Obtiene el precio actual y datos de mercado de un activo financiero.",
			Parameters: &genai.Schema{
				Type: "OBJECT",
				Properties: map[string]*genai.Schema{
					"symbol": {Type: "STRING", Description: "Símbolo del activo (ej: BTC-USD, AAPL, ETH-USD)"},
				},
				Required: []string{"symbol"},
			},
		},
		{
			Name:        "search_assets",
			Description: "Busca activos financieros por nombre o símbolo. Útil para encontrar el símbolo correcto.",
			Parameters: &genai.Schema{
				Type: "OBJECT",
				Properties: map[string]*genai.Schema{
					"query": {Type: "STRING", Description: "Nombre o símbolo parcial del activo (ej: Tesla, Bitcoin, oro)"},
				},
				Required: []string{"query"},
			},
		},
	},
}}

func (c *Client) SendMessage(ctx context.Context, history []domain.ChatMessage, userMessage string, systemContext string, tools domain.ChatToolExecutor) (domain.AIResponse, error) {
	sysInstruction := "Eres un asistente financiero integrado en la plataforma VecFin. " +
		"Tenés acceso a los datos del usuario y podés buscar noticias, precios y activos en tiempo real usando tus herramientas. " +
		"Cuando cites noticias, usá formato markdown: [título](url). " +
		"Usá las herramientas siempre que necesites datos actualizados. " +
		"Respondés en el idioma del usuario, de forma útil y concreta."
	if systemContext != "" {
		sysInstruction += "\n\nDatos del usuario en la plataforma:\n" + systemContext
	}

	config := &genai.GenerateContentConfig{
		SystemInstruction: genai.NewContentFromText(sysInstruction, "user"),
		Tools:             chatTools,
	}

	chat, err := c.client.Chats.Create(ctx, model, config, historyToContents(history))
	if err != nil {
		return domain.AIResponse{}, fmt.Errorf("gemini chat: %w", err)
	}

	result, err := chat.SendMessage(ctx, *genai.NewPartFromText(userMessage))
	if err != nil {
		return domain.AIResponse{}, fmt.Errorf("gemini chat: %w", err)
	}

	// Tool use loop (max 5 iterations)
	for i := 0; i < 5; i++ {
		if len(result.Candidates) == 0 || len(result.Candidates[0].Content.Parts) == 0 {
			break
		}

		var functionResponses []genai.Part
		for _, part := range result.Candidates[0].Content.Parts {
			if part.FunctionCall == nil {
				continue
			}
			fc := part.FunctionCall
			var output string
			switch fc.Name {
			case "search_news":
				q, _ := fc.Args["query"].(string)
				output = tools.SearchNews(q)
			case "get_asset_price":
				s, _ := fc.Args["symbol"].(string)
				output = tools.GetAssetPrice(s)
			case "search_assets":
				q, _ := fc.Args["query"].(string)
				output = tools.SearchAssets(q)
			}
			functionResponses = append(functionResponses, genai.Part{
				FunctionResponse: &genai.FunctionResponse{
					Name:     fc.Name,
					Response: map[string]any{"result": output},
				},
			})
		}

		if len(functionResponses) == 0 {
			break
		}

		result, err = chat.SendMessage(ctx, functionResponses...)
		if err != nil {
			return domain.AIResponse{}, fmt.Errorf("gemini tool response: %w", err)
		}
	}

	return domain.AIResponse{
		Content:      result.Text(),
		Provider:     "gemini",
		InputTokens:  int(result.UsageMetadata.PromptTokenCount),
		OutputTokens: int(result.UsageMetadata.CandidatesTokenCount),
	}, nil
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
