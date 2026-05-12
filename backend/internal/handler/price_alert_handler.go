package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type PriceAlertUsecasePort interface {
	CreateAlert(userID uuid.UUID, symbol string, targetPrice float64, condition domain.AlertCondition) error
	GetMyAlerts(userID uuid.UUID) ([]domain.PriceAlert, error)
	DeleteAlert(userID uuid.UUID, alertID uuid.UUID) error
}

type PriceAlertHandler struct {
	uc PriceAlertUsecasePort
}

func NewPriceAlertHandler(uc PriceAlertUsecasePort) *PriceAlertHandler {
	return &PriceAlertHandler{uc: uc}
}

func (h *PriceAlertHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("POST /notifications/alerts", auth(h.Create))
	http.HandleFunc("GET /notifications/alerts", auth(h.GetAll))
	http.HandleFunc("DELETE /notifications/alerts/{id}", auth(h.Delete))
}

type CreateAlertRequest struct {
	Symbol      string                `json:"symbol"`
	TargetPrice float64               `json:"target_price"`
	Condition   domain.AlertCondition `json:"condition"`
}

func (h *PriceAlertHandler) Create(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		http.Error(w, "ID de usuario inválido", http.StatusBadRequest)
		return
	}

	var req CreateAlertRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "JSON inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.CreateAlert(userID, req.Symbol, req.TargetPrice, req.Condition); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *PriceAlertHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		http.Error(w, "ID de usuario inválido", http.StatusBadRequest)
		return
	}

	alerts, err := h.uc.GetMyAlerts(userID)
	if err != nil {
		http.Error(w, "Error al obtener alertas", http.StatusInternalServerError)
		return
	}

	// Retornamos array vacío en vez de null si no hay alertas
	if alerts == nil {
		alerts = []domain.PriceAlert{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(alerts)
}

func (h *PriceAlertHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		http.Error(w, "ID de usuario inválido", http.StatusBadRequest)
		return
	}

	alertIDStr := r.PathValue("id")
	alertID, err := uuid.Parse(alertIDStr)
	if err != nil {
		http.Error(w, "ID de alerta inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.DeleteAlert(userID, alertID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
