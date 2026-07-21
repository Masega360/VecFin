package usecase

import (
	"context"
	"errors"
	"fmt"
	"log"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/platform/mercadopago"
	"github.com/google/uuid"
)

// Tipo de cambio ARS/USD aproximado (configurable)
const defaultARStoUSD = 1200.0

var (
	ErrNoCredit       = errors.New("sin crédito disponible: tokens gratuitos agotados y saldo en $0")
	ErrMessageTooLong = errors.New("mensaje demasiado largo para tu plan actual")
)

type BalanceUsecase struct {
	repo     domain.BalanceRepository
	mpClient *mercadopago.Client
	baseURL  string // URL base del backend para webhooks y back_urls
}

func NewBalanceUsecase(repo domain.BalanceRepository, mpClient *mercadopago.Client, baseURL string) *BalanceUsecase {
	return &BalanceUsecase{repo: repo, mpClient: mpClient, baseURL: baseURL}
}

// GetBalance devuelve el saldo actual del usuario.
func (uc *BalanceUsecase) GetBalance(ctx context.Context, userID uuid.UUID) (domain.UserBalance, error) {
	return uc.repo.GetOrCreate(ctx, userID)
}

// CreateTopup crea una preferencia de pago en MP y registra el intento.
// amountARS es lo que el usuario quiere pagar en pesos.
// Devuelve la URL de checkout para que el mobile la abra.
func (uc *BalanceUsecase) CreateTopup(ctx context.Context, userID uuid.UUID, amountARS float64) (string, error) {
	if amountARS < 100 {
		return "", errors.New("monto mínimo: $100 ARS")
	}

	amountUSD := amountARS / defaultARStoUSD
	paymentID := uuid.New()

	pref, err := uc.mpClient.CreatePreference(mercadopago.PreferenceRequest{
		Items: []mercadopago.PreferenceItem{{
			Title:      "VecFin - Carga de saldo IA",
			Quantity:   1,
			UnitPrice:  amountARS,
			CurrencyID: "ARS",
		}},
		ExternalRef: paymentID.String(),
		NotifURL:    uc.baseURL + "/webhooks/mercadopago",
	})
	if err != nil {
		return "", fmt.Errorf("crear preferencia MP: %w", err)
	}

	// Registrar intento de pago
	if err := uc.repo.CreatePayment(ctx, domain.PaymentHistory{
		ID:             paymentID,
		UserID:         userID,
		MPPreferenceID: pref.ID,
		AmountARS:      amountARS,
		AmountUSD:      amountUSD,
		Status:         domain.PaymentPending,
	}); err != nil {
		return "", fmt.Errorf("registrar pago: %w", err)
	}

	// Si es sandbox, devolver sandbox_init_point
	if uc.mpClient.IsSandbox() {
		return pref.SandboxInitPoint, nil
	}
	return pref.InitPoint, nil
}

// HandleWebhook procesa la notificación de MP. Si el pago está aprobado, acredita saldo.
func (uc *BalanceUsecase) HandleWebhook(ctx context.Context, mpPaymentID string) error {
	payment, err := uc.mpClient.GetPayment(mpPaymentID)
	if err != nil {
		return fmt.Errorf("consultar pago MP: %w", err)
	}

	if payment.Status != "approved" {
		log.Printf("[balance] webhook: pago %s status=%s (no acreditado)", mpPaymentID, payment.Status)
		return nil
	}

	// external_reference es nuestro payment_history.id
	paymentUUID, err := uuid.Parse(payment.ExternalReference)
	if err != nil {
		return fmt.Errorf("external_reference inválido: %s", payment.ExternalReference)
	}

	// Buscar el pago en nuestra DB
	dbPayment, err := uc.repo.GetPaymentByID(ctx, paymentUUID)
	if err != nil {
		log.Printf("[balance] pago no encontrado en DB para ref=%s: %v", payment.ExternalReference, err)
		return nil
	}

	// Si ya estaba aprobado, no acreditar de nuevo (idempotencia)
	if dbPayment.Status == domain.PaymentApproved {
		return nil
	}

	// Actualizar estado del pago
	_ = uc.repo.UpdatePaymentByMPPayment(ctx, mpPaymentID, domain.PaymentApproved)

	// Acreditar saldo
	if err := uc.repo.AddBalance(ctx, dbPayment.UserID, dbPayment.AmountUSD); err != nil {
		return fmt.Errorf("acreditar saldo: %w", err)
	}

	log.Printf("[balance] acreditado USD %.4f al user %s (pago MP %s)", dbPayment.AmountUSD, dbPayment.UserID, mpPaymentID)
	return nil
}

// CheckAndDeduct verifica que el usuario tenga crédito y descuenta después del uso.
// Primero consume free tokens; si se agotaron, descuenta del saldo USD.
// Devuelve el balance para que el caller sepa el tier del usuario.
func (uc *BalanceUsecase) CheckCredit(ctx context.Context, userID uuid.UUID) (domain.UserBalance, error) {
	balance, err := uc.repo.GetOrCreate(ctx, userID)
	if err != nil {
		return domain.UserBalance{}, err
	}
	if !balance.HasCredit() {
		return balance, ErrNoCredit
	}
	return balance, nil
}

// DeductUsage descuenta el costo de una llamada a la IA.
// Si hay free tokens, descuenta 1. Si no, descuenta del saldo en USD.
func (uc *BalanceUsecase) DeductUsage(ctx context.Context, userID uuid.UUID, costUSD float64) error {
	balance, err := uc.repo.GetOrCreate(ctx, userID)
	if err != nil {
		return err
	}

	if balance.FreeTokensRemaining > 0 {
		return uc.repo.DeductFreeTokens(ctx, userID, 1)
	}

	return uc.repo.DeductBalance(ctx, userID, costUSD)
}
