package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
)

type SimulatorUsecasePort interface {
	SimulateInvestments(amount float64, days int) ([]domain.SimulationResult, error)
}

type SimulatorHandler struct {
	uc SimulatorUsecasePort
}

func NewSimulatorHandler(uc SimulatorUsecasePort) *SimulatorHandler {
	return &SimulatorHandler{uc: uc}
}

func (h *SimulatorHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("POST /simulator/calculate", auth(h.Calculate))
}

func (h *SimulatorHandler) Calculate(w http.ResponseWriter, r *http.Request) {
	var body domain.SimulationRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	results, err := h.uc.SimulateInvestments(body.Amount, body.Days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
