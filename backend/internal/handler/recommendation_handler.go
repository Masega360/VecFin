package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type recommendationUsecase interface {
	Get(ctx context.Context, userID uuid.UUID) ([]domain.Recommendation, error)
}

type RecommendationHandler struct {
	uc recommendationUsecase
}

func NewRecommendationHandler(uc recommendationUsecase) *RecommendationHandler {
	return &RecommendationHandler{uc: uc}
}

func (h *RecommendationHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /recommendations", auth(h.Get))
}

func (h *RecommendationHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	recs, err := h.uc.Get(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(recs)
}
