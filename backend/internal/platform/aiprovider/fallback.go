package aiprovider

import (
	"context"
	"log"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

// Fallback intenta el proveedor primario y, si falla, usa el secundario.
type Fallback struct {
	Primary   domain.AIProvider
	Secondary domain.AIProvider
}

func (f *Fallback) GetRecommendations(ctx context.Context, input domain.RecommendationInput) ([]domain.Recommendation, error) {
	recs, err := f.Primary.GetRecommendations(ctx, input)
	if err != nil {
		log.Printf("[ai] primary failed (%v), falling back to secondary", err)
		return f.Secondary.GetRecommendations(ctx, input)
	}
	return recs, nil
}

func (f *Fallback) SendMessage(ctx context.Context, history []domain.ChatMessage, userMessage string) (string, error) {
	reply, err := f.Primary.SendMessage(ctx, history, userMessage)
	if err != nil {
		log.Printf("[ai] primary failed (%v), falling back to secondary", err)
		return f.Secondary.SendMessage(ctx, history, userMessage)
	}
	return reply, nil
}
