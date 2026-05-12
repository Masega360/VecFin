package domain

import (
	"time"

	"github.com/google/uuid"
)

// Pricing per 1M tokens (cost to us) × 1.20 markup
const (
	GeminiInputPer1M  = 0.075 * 1.20 // $0.09
	GeminiOutputPer1M = 0.30 * 1.20  // $0.36
	BedrockInputPer1M  = 1.00 * 1.20 // $1.20
	BedrockOutputPer1M = 5.00 * 1.20 // $6.00
)

type TokenUsage struct {
	ID           uuid.UUID `json:"id"`
	UserID       uuid.UUID `json:"user_id"`
	Provider     string    `json:"provider"`
	InputTokens  int       `json:"input_tokens"`
	OutputTokens int       `json:"output_tokens"`
	CostUSD      float64   `json:"cost_usd"`
	CreatedAt    time.Time `json:"created_at"`
}

type MonthlyUsage struct {
	Provider     string  `json:"provider"`
	InputTokens  int64   `json:"input_tokens"`
	OutputTokens int64   `json:"output_tokens"`
	TotalCostUSD float64 `json:"total_cost_usd"`
}

func CalculateCost(provider string, inputTokens, outputTokens int) float64 {
	var inputRate, outputRate float64
	switch provider {
	case "gemini":
		inputRate = GeminiInputPer1M
		outputRate = GeminiOutputPer1M
	case "bedrock":
		inputRate = BedrockInputPer1M
		outputRate = BedrockOutputPer1M
	default:
		inputRate = BedrockInputPer1M
		outputRate = BedrockOutputPer1M
	}
	return (float64(inputTokens)/1_000_000)*inputRate + (float64(outputTokens)/1_000_000)*outputRate
}
