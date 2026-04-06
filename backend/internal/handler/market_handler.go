package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
)

type MarketUsecasePort interface {
	SearchAssets(query string) ([]domain.Asset, error)
	GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error)
	AddFavorite(userID, assetID string) error
	RemoveFavorite(userID, assetID string) error
	ListFavorites(userID string) ([]domain.FavAsset, error)
}

type MarketHandler struct {
	uc MarketUsecasePort
}

func NewMarketHandler(uc MarketUsecasePort) *MarketHandler {
	return &MarketHandler{uc: uc}
}

func (h *MarketHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("GET /assets/search", h.SearchAssets)
	http.HandleFunc("GET /assets/favorites", auth(h.ListFavorites))
	http.HandleFunc("POST /assets/favorites", auth(h.AddFavorite))
	http.HandleFunc("DELETE /assets/favorites/{assetID}", auth(h.RemoveFavorite))
	http.HandleFunc("GET /assets/{symbol}", h.GetAssetDetails)
}

func (h *MarketHandler) SearchAssets(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	if query == "" {
		http.Error(w, "query parameter is required", http.StatusBadRequest)
		return
	}

	assets, err := h.uc.SearchAssets(query)
	if err != nil {
		http.Error(w, "error searching assets: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assets)
}

func (h *MarketHandler) ListFavorites(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	favs, err := h.uc.ListFavorites(userID)
	if err != nil {
		http.Error(w, "error listando favoritos: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(favs)
}

func (h *MarketHandler) AddFavorite(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	var body struct {
		AssetID string `json:"asset_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.AssetID == "" {
		http.Error(w, "asset_id requerido", http.StatusBadRequest)
		return
	}

	if err := h.uc.AddFavorite(userID, body.AssetID); err != nil {
		http.Error(w, "error agregando favorito: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *MarketHandler) GetAssetDetails(w http.ResponseWriter, r *http.Request) {
	symbol := r.PathValue("symbol")
	if symbol == "" {
		http.Error(w, "symbol requerido", http.StatusBadRequest)
		return
	}
	rangeParam := r.URL.Query().Get("range")

	details, err := h.uc.GetAssetDetails(symbol, rangeParam)
	if err != nil {
		http.Error(w, "error obteniendo detalles: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(details)
}

func (h *MarketHandler) RemoveFavorite(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	assetID := r.PathValue("assetID")
	if assetID == "" {
		http.Error(w, "assetID requerido", http.StatusBadRequest)
		return
	}

	if err := h.uc.RemoveFavorite(userID, assetID); err != nil {
		http.Error(w, "error eliminando favorito: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
