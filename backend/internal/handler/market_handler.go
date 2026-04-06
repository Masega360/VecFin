package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
)

var validSymbol = regexp.MustCompile(`^[A-Z0-9.\-=^]+$`)

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
	query := strings.TrimSpace(r.URL.Query().Get("query"))
	if query == "" {
		http.Error(w, "el parámetro query es requerido", http.StatusBadRequest)
		return
	}

	assets, err := h.uc.SearchAssets(query)
	if err != nil {
		http.Error(w, "error al buscar activos", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assets)
}

func (h *MarketHandler) GetAssetDetails(w http.ResponseWriter, r *http.Request) {
	symbol := strings.ToUpper(strings.TrimSpace(r.PathValue("symbol")))
	if symbol == "" {
		http.Error(w, "símbolo requerido", http.StatusBadRequest)
		return
	}
	if !validSymbol.MatchString(symbol) {
		http.Error(w, "símbolo inválido", http.StatusBadRequest)
		return
	}

	rangeParam := r.URL.Query().Get("range")
	details, err := h.uc.GetAssetDetails(symbol, rangeParam)
	if err != nil {
		if errors.Is(err, domain.ErrAssetNotFound) {
			http.Error(w, "activo no encontrado", http.StatusNotFound)
			return
		}
		http.Error(w, "error al obtener detalles del activo", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(details)
}

func (h *MarketHandler) ListFavorites(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	favs, err := h.uc.ListFavorites(userID)
	if err != nil {
		http.Error(w, "error al listar favoritos", http.StatusInternalServerError)
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
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.AssetID) == "" {
		http.Error(w, "asset_id requerido", http.StatusBadRequest)
		return
	}

	if err := h.uc.AddFavorite(userID, strings.TrimSpace(body.AssetID)); err != nil {
		http.Error(w, "error al agregar favorito", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
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
		http.Error(w, "error al eliminar favorito", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
