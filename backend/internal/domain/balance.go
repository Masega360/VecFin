package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// Free tier: 5000 tokens gratuitos para empezar
const FreeTokensDefault = 5000

// Premium: mensajes más largos (4000 chars vs 500 free)
const (
	MaxMessageLengthFree    = 500
	MaxMessageLengthPremium = 4000
)

type UserBalance struct {
	UserID              uuid.UUID `json:"user_id"`
	BalanceUSD          float64   `json:"balance_usd"`
	FreeTokensRemaining int       `json:"free_tokens_remaining"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// IsPremium indica si el usuario tiene saldo pagado (por ende beneficios premium)
func (b *UserBalance) IsPremium() bool {
	return b.BalanceUSD > 0
}

// HasCredit indica si puede usar la IA (tiene free tokens o saldo)
func (b *UserBalance) HasCredit() bool {
	return b.FreeTokensRemaining > 0 || b.BalanceUSD > 0
}

// MaxMessageLength devuelve el largo máximo de mensaje según tier
func (b *UserBalance) MaxMessageLength() int {
	if b.IsPremium() {
		return MaxMessageLengthPremium
	}
	return MaxMessageLengthFree
}

type PaymentStatus string

const (
	PaymentPending  PaymentStatus = "pending"
	PaymentApproved PaymentStatus = "approved"
	PaymentRejected PaymentStatus = "rejected"
)

type PaymentHistory struct {
	ID             uuid.UUID     `json:"id"`
	UserID         uuid.UUID     `json:"user_id"`
	MPPreferenceID string        `json:"mp_preference_id"`
	MPPaymentID    string        `json:"mp_payment_id"`
	AmountARS      float64       `json:"amount_ars"`
	AmountUSD      float64       `json:"amount_usd"`
	Status         PaymentStatus `json:"status"`
	CreatedAt      time.Time     `json:"created_at"`
	PaidAt         *time.Time    `json:"paid_at,omitempty"`
}

type BalanceRepository interface {
	// GetOrCreate devuelve el balance del usuario; si no existe, crea uno con defaults.
	GetOrCreate(ctx context.Context, userID uuid.UUID) (UserBalance, error)

	// AddBalance suma un monto en USD al saldo del usuario.
	AddBalance(ctx context.Context, userID uuid.UUID, amountUSD float64) error

	// DeductBalance resta un monto en USD del saldo. Si no alcanza, error.
	DeductBalance(ctx context.Context, userID uuid.UUID, amountUSD float64) error

	// DeductFreeTokens resta tokens gratuitos (1 por uso de IA).
	DeductFreeTokens(ctx context.Context, userID uuid.UUID, count int) error

	// CreatePayment registra un intento de pago.
	CreatePayment(ctx context.Context, p PaymentHistory) error

	// UpdatePaymentByMPPayment actualiza el estado de un pago por payment ID de MP.
	UpdatePaymentByMPPayment(ctx context.Context, mpPaymentID string, status PaymentStatus) error

	// GetPaymentByPreference busca un pago por su preference_id de MP.
	GetPaymentByPreference(ctx context.Context, mpPreferenceID string) (PaymentHistory, error)

	// GetPaymentByID busca un pago por su ID interno.
	GetPaymentByID(ctx context.Context, id uuid.UUID) (PaymentHistory, error)
}
