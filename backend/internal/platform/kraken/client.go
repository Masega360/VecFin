package kraken

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

const baseURL = "https://api.kraken.com"

type Client struct {
	http *http.Client
}

func NewClient() *Client {
	return &Client{http: &http.Client{Timeout: 15 * time.Second}}
}

func (c *Client) Name() string { return "kraken" }

// ─── Auth helpers ─────────────────────────────────────────────────────────────

func createSignature(urlPath string, data url.Values, secret string) (string, error) {
	secretBytes, err := base64.StdEncoding.DecodeString(secret)
	if err != nil {
		return "", err
	}

	sha := sha256.New()
	sha.Write([]byte(data.Get("nonce") + data.Encode()))
	shaSum := sha.Sum(nil)

	mac := hmac.New(sha512.New, secretBytes)
	mac.Write(append([]byte(urlPath), shaSum...))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil)), nil
}

// ─── GetHoldings (ExchangeService) ───────────────────────────────────────────

type balanceResponse struct {
	Error  []string           `json:"error"`
	Result map[string]string  `json:"result"`
}

// GetHoldings implementa domain.ExchangeService.
// apiKey = Kraken API key, apiSecret = Kraken private key (base64).
func (c *Client) GetHoldings(apiKey, apiSecret string) ([]domain.ExchangeHolding, error) {
	urlPath := "/0/private/Balance"
	nonce := strconv.FormatInt(time.Now().UnixMilli(), 10)

	data := url.Values{}
	data.Set("nonce", nonce)

	signature, err := createSignature(urlPath, data, apiSecret)
	if err != nil {
		return nil, fmt.Errorf("kraken: firma inválida: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+urlPath, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("kraken: crear request: %w", err)
	}
	req.Header.Set("API-Key", apiKey)
	req.Header.Set("API-Sign", signature)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("kraken: ejecutar request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("kraken: status %d", resp.StatusCode)
	}

	var balResp balanceResponse
	if err := json.NewDecoder(resp.Body).Decode(&balResp); err != nil {
		return nil, fmt.Errorf("kraken: decode: %w", err)
	}

	if len(balResp.Error) > 0 {
		return nil, fmt.Errorf("kraken: %s", strings.Join(balResp.Error, "; "))
	}

	var holdings []domain.ExchangeHolding
	for asset, balStr := range balResp.Result {
		bal, _ := strconv.ParseFloat(balStr, 64)
		if bal > 0 {
			// Kraken usa prefijos raros: XXBT = BTC, XETH = ETH, ZUSD = USD
			ticker := normalizeKrakenTicker(asset)
			holdings = append(holdings, domain.ExchangeHolding{
				Ticker:   ticker,
				Quantity: bal,
			})
		}
	}
	return holdings, nil
}

// normalizeKrakenTicker convierte los tickers de Kraken a formato estándar.
func normalizeKrakenTicker(asset string) string {
	replacements := map[string]string{
		"XXBT": "BTC",
		"XETH": "ETH",
		"XXRP": "XRP",
		"XLTC": "LTC",
		"XXLM": "XLM",
		"XDOGE": "DOGE",
		"ZUSD": "USD",
		"ZEUR": "EUR",
		"ZGBP": "GBP",
		"ZJPY": "JPY",
		"ZCAD": "CAD",
		"ZAUD": "AUD",
	}
	if normalized, ok := replacements[asset]; ok {
		return normalized
	}
	// Quitar prefijo X o Z si tiene 4+ chars
	if len(asset) >= 4 && (asset[0] == 'X' || asset[0] == 'Z') {
		return asset[1:]
	}
	return asset
}
