package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// FiscalReportLine representa una línea del reporte fiscal (un asset valuado).
type FiscalReportLine struct {
	Ticker      string  `json:"ticker"`
	Name        string  `json:"name"`
	Quantity    float64 `json:"quantity"`
	PriceUSD    float64 `json:"price_usd"`
	TotalUSD    float64 `json:"total_usd"`
	WalletName  string  `json:"wallet_name"`
}

// FiscalReport agrupa toda la información del reporte fiscal de un usuario.
type FiscalReport struct {
	UserName    string             `json:"user_name"`
	Email       string             `json:"email"`
	GeneratedAt time.Time          `json:"generated_at"`
	Lines       []FiscalReportLine `json:"lines"`
	TotalUSD    float64            `json:"total_usd"`
	AIUsage     []MonthlyUsage     `json:"ai_usage"`
}

// PDFGenerator define la interfaz para generar PDFs (desacoplado del framework).
type PDFGenerator interface {
	GenerateFiscalReport(report FiscalReport) ([]byte, error)
}

// TokenUsageRepository define el contrato para consultar uso de IA.
type TokenUsageRepository interface {
	Record(ctx context.Context, userID uuid.UUID, provider string, inputTokens, outputTokens int, costUSD float64) error
	GetMonthly(ctx context.Context, userID uuid.UUID) ([]MonthlyUsage, error)
}
