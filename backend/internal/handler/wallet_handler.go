package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type WalletUsecasePort interface {
	Create(ctx context.Context, wallet domain.Wallet) (uuid.UUID, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error)
	Read(ctx context.Context, id, userID uuid.UUID) (domain.Wallet, error)
	Update(ctx context.Context, id, userID uuid.UUID, changes domain.Wallet) error
	UpdateLastSync(ctx context.Context, id, userID uuid.UUID) error
	Delete(ctx context.Context, id, userID uuid.UUID) error
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
		http.Error(w, "wallet no encontrada", http.StatusNotFound)
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

// Sync marca la wallet como recién sincronizada con la API de la plataforma.
// El proceso real de fetch a la plataforma se implementa en el usecase de sync.
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

	if err := h.uc.UpdateLastSync(r.Context(), walletID, userID); err != nil {
		handleUsecaseErr(w, err)
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

func (h *WalletHandler) AddAsset(w http.ResponseWriter, r *http.Request)         {}
func (h *WalletHandler) GetAssets(w http.ResponseWriter, r *http.Request)        {}
func (h *WalletHandler) GetWalletDetails(w http.ResponseWriter, r *http.Request) {}
