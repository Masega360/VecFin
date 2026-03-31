package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type MarketHandler struct {
	uc domain.MarketService
}

func NewMarketHandler(uc domain.MarketService) *MarketHandler {
	return &MarketHandler{uc: uc}
}

func (h *MarketHandler) SearchAssets(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "Query parameter is required", http.StatusBadRequest)
		return
	}

	assets, err := h.uc.SearchAssets(query)
	if err != nil {
		http.Error(w, "Error searching assets: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assets)
}
