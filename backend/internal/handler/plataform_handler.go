package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type PlataformUsecasePort interface {
	SearchPlataforms(query string) ([]domain.Plataform, error)
	GetPlataformDetails(id string) (*domain.Plataform, error)
}

type PlataformHandler struct {
	uc PlataformUsecasePort
}

func NewPlataformHandler(uc PlataformUsecasePort) *PlataformHandler {
	return &PlataformHandler{uc: uc}
}

func (h *PlataformHandler) RegisterRoutes(jwtSecret string) {
	http.HandleFunc("GET /plataforms/search", h.SearchPlataforms)
	http.HandleFunc("GET /plataforms/{id}", h.GetPlataformDetails)
}

func (h *PlataformHandler) SearchPlataforms(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	if query == "" {
		http.Error(w, "el parámetro query es requerido", http.StatusBadRequest)
		return
	}
	plataforms, err := h.uc.SearchPlataforms(query)
	if err != nil {
		http.Error(w, "error al buscar plataformas", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plataforms)
}

func (h *PlataformHandler) GetPlataformDetails(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		http.Error(w, "el parámetro id es requerido", http.StatusBadRequest)
		return
	}
	plataform, err := h.uc.GetPlataformDetails(id)
	if err != nil {
		http.Error(w, "error al obtener detalles de la plataforma", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(plataform)
}
