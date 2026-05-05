package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type NotificationSettingsPort interface {
	GetSettings(userID uuid.UUID) (domain.NotificationSetting, error)
	UpdateSettings(userID uuid.UUID, input domain.NotificationSetting) error
}

type NotificationSettingsHandler struct {
	uc NotificationSettingsPort
}

func NewNotificationSettingHandler(uc NotificationSettingsPort) *NotificationSettingsHandler {
	return &NotificationSettingsHandler{uc}
}

func (h *NotificationSettingsHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	// Rutas protegidas para manejar las preferencias del usuario logueado
	http.HandleFunc("GET /notifications/settings", auth(h.GetSettings))
	http.HandleFunc("PUT /notifications/settings", auth(h.UpdateSettings))
}

func (h *NotificationSettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	// Extraemos el ID del token JWT
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No se encontró el ID válido en el token", http.StatusUnauthorized)
		return
	}

	parse, _ := uuid.Parse(userID)
	settings, err := h.uc.GetSettings(parse)
	if err != nil {
		http.Error(w, "Error al obtener configuraciones: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(settings)
}

func (h *NotificationSettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	// Extraemos el ID del token JWT para evitar que modifiquen el de otro
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No se encontró el ID válido en el token", http.StatusUnauthorized)
		return
	}

	// Decodificamos el body directamente en el struct de dominio
	var body domain.NotificationSetting
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	parse, _ := uuid.Parse(userID)
	if err := h.uc.UpdateSettings(parse, body); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
