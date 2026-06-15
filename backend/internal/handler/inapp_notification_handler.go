package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/Masega360/vecfin/backend/internal/usecase"
	"github.com/google/uuid"
)

type InAppNotificationHandler struct {
	uc *usecase.InAppNotificationUsecase
}

func NewInAppNotificationHandler(uc *usecase.InAppNotificationUsecase) *InAppNotificationHandler {
	return &InAppNotificationHandler{uc: uc}
}

func (h *InAppNotificationHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("GET /notifications/inapp", auth(h.GetMyNotifications))
	http.HandleFunc("PATCH /notifications/inapp/{id}/read", auth(h.MarkAsRead))
	http.HandleFunc("GET /notifications/inapp/unread-count", auth(h.GetUnreadCount))
}

func (h *InAppNotificationHandler) GetMyNotifications(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	notifs, err := h.uc.GetMyNotifications(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if notifs == nil {
		notifs = make([]domain.InAppNotification, 0)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notifs)
}

func (h *InAppNotificationHandler) MarkAsRead(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	notifIDStr := r.PathValue("id")
	notifID, err := uuid.Parse(notifIDStr)
	if err != nil {
		http.Error(w, "ID de notificación inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.MarkAsRead(notifID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *InAppNotificationHandler) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	count, err := h.uc.GetUnreadCount(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"unread_count": count})
}

func (h *InAppNotificationHandler) getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	userStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		return uuid.Nil, http.ErrNoCookie
	}
	return uuid.Parse(userStr)
}
