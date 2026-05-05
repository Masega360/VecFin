package binance

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

const baseURL = "https://api.binance.com"

type Client struct {
	http *http.Client
}

func NewClient() *Client {
	return &Client{http: &http.Client{Timeout: 10 * time.Second}}
}

type binanceBalance struct {
	Asset  string `json:"asset"`
	Free   string `json:"free"`
	Locked string `json:"locked"`
}

type accountResponse struct {
	Balances []binanceBalance `json:"balances"`
}

// GetHoldings implementa domain.ExchangeService.
// Devuelve solo los activos con cantidad > 0.
func (c *Client) GetHoldings(apiKey, apiSecret string) ([]domain.ExchangeHolding, error) {
	timestamp := strconv.FormatInt(time.Now().UnixMilli(), 10)
	query := "timestamp=" + timestamp

	mac := hmac.New(sha256.New, []byte(apiSecret))
	mac.Write([]byte(query))
	signature := fmt.Sprintf("%x", mac.Sum(nil))

	url := baseURL + "/api/v3/account?" + query + "&signature=" + signature

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("binance: crear request: %w", err)
	}
	req.Header.Set("X-MBX-APIKEY", apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("binance: ejecutar request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("binance: status %d", resp.StatusCode)
	}

	var account accountResponse
	if err := json.NewDecoder(resp.Body).Decode(&account); err != nil {
		return nil, fmt.Errorf("binance: decodificar respuesta: %w", err)
	}

	var holdings []domain.ExchangeHolding
	for _, b := range account.Balances {
		free, _ := strconv.ParseFloat(b.Free, 64)
		locked, _ := strconv.ParseFloat(b.Locked, 64)
		total := free + locked
		if total > 0 {
			holdings = append(holdings, domain.ExchangeHolding{
				Ticker:   b.Asset,
				Quantity: total,
			})
		}
	}
	return holdings, nil
}
