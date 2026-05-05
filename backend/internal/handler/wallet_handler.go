package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/Masega360/vecfin/backend/internal/usecase"
	"github.com/google/uuid"
)

type WalletUsecasePort interface {
	Create(ctx context.Context, wallet domain.Wallet) (uuid.UUID, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error)
	Read(ctx context.Context, id, userID uuid.UUID) (domain.Wallet, error)
	Update(ctx context.Context, id, userID uuid.UUID, changes domain.Wallet) error
	SyncFromExchange(ctx context.Context, id, userID uuid.UUID) error
	Delete(ctx context.Context, id, userID uuid.UUID) error

	// Gestión de assets dentro de la wallet
	AddAsset(ctx context.Context, walletID, userID uuid.UUID, ticker string, quantity float64) (domain.AssetWallet, error)
	ListAssets(ctx context.Context, walletID, userID uuid.UUID) ([]domain.AssetWallet, error)
	UpdateAssetQuantity(ctx context.Context, walletID, userID uuid.UUID, ticker string, quantity float64) error
	RemoveAsset(ctx context.Context, walletID, userID uuid.UUID, ticker string) error
	GetWalletDetails(ctx context.Context, walletID, userID uuid.UUID) (domain.WalletDetails, error)
}

type WalletHandler struct {
	uc WalletUsecasePort
}

func NewWalletHandler(uc WalletUsecasePort) *WalletHandler {
	return &WalletHandler{uc: uc}
}

func (h *WalletHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("POST /wallets", auth(h.CreateManual))
	http.HandleFunc("POST /wallets/connect", auth(h.CreateConnected))
	http.HandleFunc("GET /wallets", auth(h.ListByUser))
	http.HandleFunc("GET /wallets/{id}", auth(h.Read))
	http.HandleFunc("PUT /wallets/{id}", auth(h.Update))
	http.HandleFunc("POST /wallets/{id}/sync", auth(h.Sync))
	http.HandleFunc("DELETE /wallets/{id}", auth(h.Delete))

	// Assets dentro de una wallet
	http.HandleFunc("GET /wallets/{id}/details", auth(h.GetWalletDetails))
	http.HandleFunc("POST /wallets/{id}/assets", auth(h.AddAsset))
	http.HandleFunc("GET /wallets/{id}/assets", auth(h.GetAssets))
	http.HandleFunc("PUT /wallets/{id}/assets/{ticker}", auth(h.UpdateAsset))
	http.HandleFunc("DELETE /wallets/{id}/assets/{ticker}", auth(h.RemoveAsset))
}

// userIDFromContext extrae y parsea el user_id que dejó el middleware JWT en el contexto.
func userIDFromContext(r *http.Request) (uuid.UUID, error) {
	raw, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		return uuid.Nil, errors.New("user_id no encontrado en el contexto")
	}
	return uuid.Parse(raw)
}

// walletIDFromPath parsea el {id} de la URL.
func walletIDFromPath(r *http.Request) (uuid.UUID, error) {
	return uuid.Parse(r.PathValue("id"))
}

// handleUsecaseErr mapea los errores de dominio a status HTTP.
func handleUsecaseErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrForbidden):
		http.Error(w, "acceso denegado", http.StatusForbidden)
	case errors.Is(err, domain.ErrNotFound):
		http.Error(w, "recurso no encontrado", http.StatusNotFound)
	case errors.Is(err, usecase.ErrInvalidQuantity),
		errors.Is(err, usecase.ErrInvalidTicker):
		http.Error(w, err.Error(), http.StatusBadRequest)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

// CreateManual crea una wallet sin API key (seguimiento manual de activos).
// Body: { "platform_id", "name" }
func (h *WalletHandler) CreateManual(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	var body struct {
		PlatformID string `json:"platform_id"`
		Name       string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}
	platformID, err := uuid.Parse(body.PlatformID)
	if err != nil {
		http.Error(w, "platform_id inválido", http.StatusBadRequest)
		return
	}

	id, err := h.uc.Create(r.Context(), domain.Wallet{
		UserID:     userID,
		PlatformID: platformID,
		Name:       body.Name,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": id.String()})
}

// CreateConnected crea una wallet conectada a la API de una plataforma.
// Body: { "platform_id", "name", "api_key", "api_secret" }
func (h *WalletHandler) CreateConnected(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	var body struct {
		PlatformID string `json:"platform_id"`
		Name       string `json:"name"`
		APIKey     string `json:"api_key"`
		APISecret  string `json:"api_secret"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}
	if body.APIKey == "" || body.APISecret == "" {
		http.Error(w, "api_key y api_secret son requeridos para una wallet conectada", http.StatusBadRequest)
		return
	}
	platformID, err := uuid.Parse(body.PlatformID)
	if err != nil {
		http.Error(w, "platform_id inválido", http.StatusBadRequest)
		return
	}

	id, err := h.uc.Create(r.Context(), domain.Wallet{
		UserID:     userID,
		PlatformID: platformID,
		Name:       body.Name,
		APIKey:     &body.APIKey,
		APISecret:  &body.APISecret,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": id.String()})
}

// ─── READ ─────────────────────────────────────────────────────────────────────

// ListByUser devuelve todas las wallets del usuario autenticado.
func (h *WalletHandler) ListByUser(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	wallets, err := h.uc.ListByUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wallets)
}

// Read devuelve el detalle de una wallet. Solo el dueño puede verla.
func (h *WalletHandler) Read(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	wallet, err := h.uc.Read(r.Context(), walletID, userID)
	if err != nil {
		handleUsecaseErr(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(wallet)
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

// Update permite al usuario cambiar el nombre y/o credenciales de su wallet.
// Todos los campos son opcionales: solo se actualizan los que vengan en el body.
// Body (todos opcionales): { "name", "api_key", "api_secret" }
func (h *WalletHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	// Todos los campos son punteros: nil significa "no cambiar"
	var body struct {
		Name      *string `json:"name"`
		APIKey    *string `json:"api_key"`
		APISecret *string `json:"api_secret"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	changes := domain.Wallet{}
	if body.Name != nil {
		changes.Name = *body.Name
	}
	changes.APIKey = body.APIKey
	changes.APISecret = body.APISecret

	if err := h.uc.Update(r.Context(), walletID, userID, changes); err != nil {
		handleUsecaseErr(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Sync llama al exchange de la plataforma para importar los holdings actuales
// y actualiza los assets de la wallet. Requiere que la wallet tenga API key/secret.
func (h *WalletHandler) Sync(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.SyncFromExchange(r.Context(), walletID, userID); err != nil {
		switch {
		case errors.Is(err, domain.ErrNoAPICredentials),
			errors.Is(err, domain.ErrExchangeNotSupported):
			http.Error(w, err.Error(), http.StatusBadRequest)
		default:
			handleUsecaseErr(w, err)
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

// Delete elimina la wallet. Solo el dueño puede borrarla.
func (h *WalletHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.Delete(r.Context(), walletID, userID); err != nil {
		handleUsecaseErr(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ─── ASSETS DE LA WALLET ──────────────────────────────────────────────────────

// AddAsset agrega una tenencia a la wallet. Si el ticker ya existe, se suma la cantidad.
// Body: { "ticker": "AAPL", "quantity": 10 }
func (h *WalletHandler) AddAsset(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		Ticker   string  `json:"ticker"`
		Quantity float64 `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	asset, err := h.uc.AddAsset(r.Context(), walletID, userID, body.Ticker, body.Quantity)
	if err != nil {
		handleUsecaseErr(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(asset)
}

// GetAssets devuelve las tenencias crudas (ticker + quantity) de la wallet.
func (h *WalletHandler) GetAssets(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	assets, err := h.uc.ListAssets(r.Context(), walletID, userID)
	if err != nil {
		handleUsecaseErr(w, err)
		return
	}
	if assets == nil {
		assets = []domain.AssetWallet{}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(assets)
}

// UpdateAsset reemplaza la cantidad de un ticker dentro de la wallet.
// Body: { "quantity": 12.5 }
func (h *WalletHandler) UpdateAsset(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}
	ticker := r.PathValue("ticker")
	if ticker == "" {
		http.Error(w, "ticker requerido", http.StatusBadRequest)
		return
	}

	var body struct {
		Quantity float64 `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	if err := h.uc.UpdateAssetQuantity(r.Context(), walletID, userID, ticker, body.Quantity); err != nil {
		handleUsecaseErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RemoveAsset elimina un ticker de la wallet.
func (h *WalletHandler) RemoveAsset(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}
	ticker := r.PathValue("ticker")
	if ticker == "" {
		http.Error(w, "ticker requerido", http.StatusBadRequest)
		return
	}

	if err := h.uc.RemoveAsset(r.Context(), walletID, userID, ticker); err != nil {
		handleUsecaseErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetWalletDetails devuelve la wallet con cada asset valuado al precio actual
// y el total. Útil para la pantalla de detalle de una wallet en la app móvil.
func (h *WalletHandler) GetWalletDetails(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}
	walletID, err := walletIDFromPath(r)
	if err != nil {
		http.Error(w, "id inválido", http.StatusBadRequest)
		return
	}

	details, err := h.uc.GetWalletDetails(r.Context(), walletID, userID)
	if err != nil {
		handleUsecaseErr(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(details)
}
