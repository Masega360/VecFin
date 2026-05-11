package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type platformUsecasePort interface {
	GetAllPlatforms() ([]domain.Platform, error)
	SearchPlatform(query string) ([]domain.Platform, error)
	GetPlatformDetails(id string) (*domain.Platform, error)
}

type platformHandler struct {
	uc                 platformUsecasePort
	supportedExchanges map[string]bool
}

func NewPlatformHandler(uc platformUsecasePort, supportedExchanges map[string]bool) *platformHandler {
	return &platformHandler{uc: uc, supportedExchanges: supportedExchanges}
}

func (h *platformHandler) RegisterRoutes(jwtSecret string) {
	http.HandleFunc("GET /platform", h.GetAllPlatforms)
	http.HandleFunc("GET /platform/search", h.SearchPlatform)
	http.HandleFunc("GET /platform/{id}", h.GetPlatformDetails)
}

func (h *platformHandler) GetAllPlatforms(w http.ResponseWriter, r *http.Request) {
	platforms, err := h.uc.GetAllPlatforms()
	if err != nil {
		http.Error(w, "error al obtener plataformas", http.StatusInternalServerError)
		return
	}
	for i := range platforms {
		platforms[i].SyncSupported = h.supportedExchanges[strings.ToLower(platforms[i].Name)]
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(platforms)
}

func (h *platformHandler) SearchPlatform(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	if query == "" {
		http.Error(w, "el parámetro query es requerido", http.StatusBadRequest)
		return
	}
	platform, err := h.uc.SearchPlatform(query)
	if err != nil {
		http.Error(w, "error al buscar plataformas", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(platform)
}

func (h *platformHandler) GetPlatformDetails(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		http.Error(w, "el parámetro id es requerido", http.StatusBadRequest)
		return
	}
	platform, err := h.uc.GetPlatformDetails(id)
	if err != nil {
		http.Error(w, "error al obtener detalles de la plataforma", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(platform)
}
