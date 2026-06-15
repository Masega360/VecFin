package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type DashboardUsecasePort interface {
	GetDashboard(userID uuid.UUID) (domain.DashboardData, error)
	GetGuestDashboard(viewerID, targetID uuid.UUID) (domain.DashboardData, error)
}

type DashboardHandler struct {
	uc DashboardUsecasePort
}

func NewDashboardHandler(uc DashboardUsecasePort) *DashboardHandler {
	return &DashboardHandler{uc: uc}
}

func (h *DashboardHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	// Mi propio dashboard
	http.HandleFunc("GET /dashboard", auth(h.GetMyDashboard))

	// Visitar el perfil/dashboard de otro usuario
	http.HandleFunc("GET /users/{id}/dashboard", auth(h.GetGuestDashboard))
}

// GetMyDashboard devuelve el dashboard principal del usuario autenticado (con todo visible)
func (h *DashboardHandler) GetMyDashboard(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		http.Error(w, "ID de token inválido", http.StatusBadRequest)
		return
	}

	data, err := h.uc.GetDashboard(userID)
	if err != nil {
		http.Error(w, "Error obteniendo dashboard: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (h *DashboardHandler) GetGuestDashboard(w http.ResponseWriter, r *http.Request) {
	targetIDStr := r.PathValue("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		http.Error(w, "ID de usuario objetivo inválido", http.StatusBadRequest)
		return
	}

	viewerIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	viewerID, err := uuid.Parse(viewerIDStr)
	if err != nil {
		http.Error(w, "ID de token inválido", http.StatusUnauthorized)
		return
	}

	data, err := h.uc.GetGuestDashboard(viewerID, targetID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
