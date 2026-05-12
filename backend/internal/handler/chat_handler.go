package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type chatUsecase interface {
	CreateSession(ctx context.Context, userID uuid.UUID, title string) (domain.ChatSession, error)
	ListSessions(ctx context.Context, userID uuid.UUID) ([]domain.ChatSession, error)
	ListMessages(ctx context.Context, sessionID, userID uuid.UUID) ([]domain.ChatMessage, error)
	SendMessage(ctx context.Context, sessionID, userID uuid.UUID, content string) (domain.ChatMessage, error)
}

type ChatHandler struct {
	uc chatUsecase
}

func NewChatHandler(uc chatUsecase) *ChatHandler {
	return &ChatHandler{uc: uc}
}

func (h *ChatHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /chat/sessions", auth(h.ListSessions))
	http.HandleFunc("POST /chat/sessions", auth(h.CreateSession))
	http.HandleFunc("GET /chat/sessions/{id}/messages", auth(h.ListMessages))
	http.HandleFunc("POST /chat/sessions/{id}/messages", auth(h.SendMessage))
}

func (h *ChatHandler) CreateSession(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	session, err := h.uc.CreateSession(r.Context(), userID, body.Title)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(session)
}

func (h *ChatHandler) ListSessions(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	sessions, err := h.uc.ListSessions(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if sessions == nil {
		sessions = []domain.ChatSession{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(sessions)
}

func (h *ChatHandler) ListMessages(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	sessionID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}
	msgs, err := h.uc.ListMessages(r.Context(), sessionID, userID)
	if err != nil {
		handleUsecaseErr(w, err)
		return
	}
	if msgs == nil {
		msgs = []domain.ChatMessage{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(msgs)
}

func (h *ChatHandler) SendMessage(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	sessionID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" {
		http.Error(w, "content requerido", http.StatusBadRequest)
		return
	}
	msg, err := h.uc.SendMessage(r.Context(), sessionID, userID, body.Content)
	if err != nil {
		handleUsecaseErr(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(msg)
}
