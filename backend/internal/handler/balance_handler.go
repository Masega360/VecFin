package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type BalanceUsecasePort interface {
	GetBalance(ctx context.Context, userID uuid.UUID) (domain.UserBalance, error)
	CreateTopup(ctx context.Context, userID uuid.UUID, amountARS float64) (string, error)
	HandleWebhook(ctx context.Context, mpPaymentID string) error
}

type BalanceHandler struct {
	uc BalanceUsecasePort
}

func NewBalanceHandler(uc BalanceUsecasePort) *BalanceHandler {
	return &BalanceHandler{uc: uc}
}

func (h *BalanceHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /balance", auth(h.GetBalance))
	http.HandleFunc("POST /balance/topup", auth(h.Topup))
	http.HandleFunc("POST /webhooks/mercadopago", h.Webhook) // sin auth, MP lo llama
}

// GetBalance devuelve el saldo actual del usuario.
func (h *BalanceHandler) GetBalance(w http.ResponseWriter, r *http.Request) {
	userID, err := balanceUserID(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	balance, err := h.uc.GetBalance(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"balance_usd":           balance.BalanceUSD,
		"free_tokens_remaining": balance.FreeTokensRemaining,
		"is_premium":            balance.IsPremium(),
		"max_message_length":    balance.MaxMessageLength(),
	})
}

// Topup crea una preferencia de pago en MercadoPago.
// Body: { "amount_ars": 5000 }
// Response: { "checkout_url": "https://..." }
func (h *BalanceHandler) Topup(w http.ResponseWriter, r *http.Request) {
	userID, err := balanceUserID(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	var body struct {
		AmountARS float64 `json:"amount_ars"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	checkoutURL, err := h.uc.CreateTopup(r.Context(), userID, body.AmountARS)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"checkout_url": checkoutURL,
	})
}

// Webhook recibe notificaciones de MercadoPago.
// MP envía: { "type": "payment", "data": { "id": "12345" } }
func (h *BalanceHandler) Webhook(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Type string `json:"type"`
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "payload inválido", http.StatusBadRequest)
		return
	}

	// Solo procesamos notificaciones de tipo "payment"
	if body.Type != "payment" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if body.Data.ID == "" {
		http.Error(w, "payment id vacío", http.StatusBadRequest)
		return
	}

	if err := h.uc.HandleWebhook(r.Context(), body.Data.ID); err != nil {
		// MP reintenta si devolvemos error, mejor loguear y devolver 200
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func balanceUserID(r *http.Request) (uuid.UUID, error) {
	raw, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		return uuid.Nil, http.ErrNoCookie
	}
	return uuid.Parse(raw)
}
