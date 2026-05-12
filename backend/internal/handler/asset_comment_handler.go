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
	Create(ctx context.Context, symbol string, authorID uuid.UUID, content string, parentID *uuid.UUID) (domain.AssetComment, error)
	ListBySymbol(ctx context.Context, symbol string, userID *uuid.UUID) ([]domain.AssetComment, error)
	ToggleLike(ctx context.Context, commentID, userID uuid.UUID) (bool, error)
}

type AssetCommentHandler struct {
	repo assetCommentRepo
}

func NewAssetCommentHandler(repo assetCommentRepo) *AssetCommentHandler {
	return &AssetCommentHandler{repo: repo}
}

func (h *AssetCommentHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /assets/{symbol}/comments", auth(h.List))
	http.HandleFunc("POST /assets/{symbol}/comments", auth(h.Create))
	http.HandleFunc("POST /assets/comments/{id}/like", auth(h.ToggleLike))
}

func (h *AssetCommentHandler) List(w http.ResponseWriter, r *http.Request) {
	symbol := r.PathValue("symbol")
	userID, _ := userIDFromContext(r)
	var uid *uuid.UUID
	if userID != uuid.Nil {
		uid = &userID
	}
	comments, err := h.repo.ListBySymbol(r.Context(), symbol, uid)
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
		Content  string  `json:"content"`
		ParentID *string `json:"parent_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" {
		http.Error(w, "content requerido", http.StatusBadRequest)
		return
	}
	var parentID *uuid.UUID
	if body.ParentID != nil {
		pid, err := uuid.Parse(*body.ParentID)
		if err == nil {
			parentID = &pid
		}
	}
	comment, err := h.repo.Create(r.Context(), symbol, userID, body.Content, parentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(comment)
}

func (h *AssetCommentHandler) ToggleLike(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	commentID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}
	liked, err := h.repo.ToggleLike(r.Context(), commentID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"liked": liked})
}
