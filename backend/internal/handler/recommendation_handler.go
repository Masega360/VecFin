package handler

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type recommendationUsecase interface {
	Get(ctx context.Context, userID uuid.UUID) ([]domain.Recommendation, error)
	Refresh(ctx context.Context, userID uuid.UUID) ([]domain.Recommendation, error)
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
	http.HandleFunc("PATCH /recommendations/refresh", auth(h.Refresh))
}

func (h *RecommendationHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	recs, err := h.uc.Get(r.Context(), userID)
	if err != nil {
		log.Printf("[recommendations] error: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(recs)
}

func (h *RecommendationHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	recs, err := h.uc.Refresh(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(recs)
}
