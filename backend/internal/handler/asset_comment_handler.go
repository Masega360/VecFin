package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type assetCommentRepo interface {
	Create(ctx context.Context, symbol string, authorID uuid.UUID, content string) (domain.AssetComment, error)
	ListBySymbol(ctx context.Context, symbol string) ([]domain.AssetComment, error)
}

type AssetCommentHandler struct {
	repo assetCommentRepo
}

func NewAssetCommentHandler(repo assetCommentRepo) *AssetCommentHandler {
	return &AssetCommentHandler{repo: repo}
}

func (h *AssetCommentHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /assets/{symbol}/comments", h.List)
	http.HandleFunc("POST /assets/{symbol}/comments", auth(h.Create))
}

func (h *AssetCommentHandler) List(w http.ResponseWriter, r *http.Request) {
	symbol := r.PathValue("symbol")
	comments, err := h.repo.ListBySymbol(r.Context(), symbol)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if comments == nil {
		comments = []domain.AssetComment{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(comments)
}

func (h *AssetCommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	symbol := r.PathValue("symbol")
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" {
		http.Error(w, "content requerido", http.StatusBadRequest)
		return
	}
	comment, err := h.repo.Create(r.Context(), symbol, userID, body.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(comment)
}
