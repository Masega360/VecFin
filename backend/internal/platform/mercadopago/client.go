package mercadopago

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const apiURL = "https://api.mercadopago.com"

// Client es el cliente HTTP para interactuar con la API de MercadoPago.
type Client struct {
	accessToken string
	http        *http.Client
}

func NewClient(accessToken string) *Client {
	return &Client{
		accessToken: accessToken,
		http:        &http.Client{Timeout: 15 * time.Second},
	}
}

// ─── Crear Preferencia de Pago ───────────────────────────────────────────────

type PreferenceItem struct {
	Title      string  `json:"title"`
	Quantity   int     `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	CurrencyID string  `json:"currency_id"`
}

type BackURLs struct {
	Success string `json:"success"`
	Failure string `json:"failure"`
	Pending string `json:"pending"`
}

type PreferenceRequest struct {
	Items       []PreferenceItem `json:"items"`
	BackURLs    BackURLs         `json:"back_urls"`
	ExternalRef string           `json:"external_reference"`
	NotifURL    string           `json:"notification_url,omitempty"`
	AutoReturn  string           `json:"auto_return,omitempty"`
}

type PreferenceResponse struct {
	ID              string `json:"id"`
	InitPoint       string `json:"init_point"`
	SandboxInitPoint string `json:"sandbox_init_point"`
}

// CreatePreference crea una preferencia de pago en MercadoPago.
// Devuelve el ID de la preferencia y la URL de checkout (init_point o sandbox).
func (c *Client) CreatePreference(req PreferenceRequest) (*PreferenceResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("mp: marshal preference: %w", err)
	}

	httpReq, err := http.NewRequest(http.MethodPost, apiURL+"/checkout/preferences", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("mp: crear request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("mp: ejecutar request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mp: crear preferencia status %d", resp.StatusCode)
	}

	var pref PreferenceResponse
	if err := json.NewDecoder(resp.Body).Decode(&pref); err != nil {
		return nil, fmt.Errorf("mp: decode preferencia: %w", err)
	}
	return &pref, nil
}

// ─── Consultar Pago ──────────────────────────────────────────────────────────

type PaymentInfo struct {
	ID                int64   `json:"id"`
	Status            string  `json:"status"`
	StatusDetail      string  `json:"status_detail"`
	ExternalReference string  `json:"external_reference"`
	TransactionAmount float64 `json:"transaction_amount"`
	CurrencyID        string  `json:"currency_id"`
}

// GetPayment consulta el estado de un pago por su ID.
func (c *Client) GetPayment(paymentID string) (*PaymentInfo, error) {
	httpReq, err := http.NewRequest(http.MethodGet, apiURL+"/v1/payments/"+paymentID, nil)
	if err != nil {
		return nil, fmt.Errorf("mp: crear request payment: %w", err)
	}
	httpReq.Header.Set("Authorization", "Bearer "+c.accessToken)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("mp: consultar pago: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mp: consultar pago status %d", resp.StatusCode)
	}

	var info PaymentInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("mp: decode pago: %w", err)
	}
	return &info, nil
}

// IsSandbox indica si las credenciales son de test.
func (c *Client) IsSandbox() bool {
	return len(c.accessToken) > 4 && c.accessToken[:5] == "TEST-"
}
