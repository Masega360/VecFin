package binance

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
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

func (c *Client) Name() string { return "binance" }

// ─── SearchAssets ─────────────────────────────────────────────────────────────

type exchangeInfoResponse struct {
	Symbols []struct {
		Symbol     string `json:"symbol"`
		BaseAsset  string `json:"baseAsset"`
		QuoteAsset string `json:"quoteAsset"`
		Status     string `json:"status"`
	} `json:"symbols"`
}

func (c *Client) SearchAssets(query string) ([]domain.Asset, error) {
	req, err := http.NewRequest(http.MethodGet, baseURL+"/api/v3/exchangeInfo", nil)
	if err != nil {
		return nil, fmt.Errorf("binance search: %w", err)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("binance search: %w", err)
	}
	defer resp.Body.Close()

	var info exchangeInfoResponse
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, fmt.Errorf("binance search decode: %w", err)
	}

	q := strings.ToUpper(query)
	var results []domain.Asset
	for _, s := range info.Symbols {
		if s.Status != "TRADING" {
			continue
		}
		if strings.Contains(s.BaseAsset, q) || strings.Contains(s.Symbol, q) {
			results = append(results, domain.Asset{
				Symbol: s.BaseAsset,
				Name:   s.BaseAsset,
				Type:   "CRYPTO",
				Source: "binance",
			})
			if len(results) >= 8 {
				break
			}
		}
	}
	// deduplicar por Symbol
	seen := make(map[string]bool, len(results))
	deduped := results[:0]
	for _, r := range results {
		if !seen[r.Symbol] {
			seen[r.Symbol] = true
			deduped = append(deduped, r)
		}
	}
	return deduped, nil
}

// ─── GetAssetDetails ──────────────────────────────────────────────────────────

type tickerPriceResponse struct {
	Symbol string `json:"symbol"`
	Price  string `json:"price"`
}

type ticker24hResponse struct {
	Symbol             string `json:"symbol"`
	PriceChange        string `json:"priceChange"`
	PriceChangePercent string `json:"priceChangePercent"`
	LastPrice          string `json:"lastPrice"`
	OpenPrice          string `json:"openPrice"`
	HighPrice          string `json:"highPrice"`
	LowPrice           string `json:"lowPrice"`
	Volume             string `json:"volume"`
}

type klinesResponse [][]interface{}

func (c *Client) GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error) {
	base := strings.ToUpper(symbol)

	// Intentar pares en orden de preferencia
	quotes := []string{"USDT", "BUSD", "BTC", "BNB", "ETH"}
	var pair string
	var t24 ticker24hResponse
	for _, q := range quotes {
		candidate := base + q
		req24, _ := http.NewRequest(http.MethodGet, baseURL+"/api/v3/ticker/24hr?symbol="+candidate, nil)
		resp24, err := c.http.Do(req24)
		if err != nil {
			continue
		}
		if resp24.StatusCode == http.StatusOK {
			if err := json.NewDecoder(resp24.Body).Decode(&t24); err == nil && t24.LastPrice != "" {
				pair = candidate
				resp24.Body.Close()
				break
			}
		}
		resp24.Body.Close()
	}

	if pair == "" {
		return nil, domain.ErrAssetNotFound
	}

	price, _     := strconv.ParseFloat(t24.LastPrice, 64)
	change, _    := strconv.ParseFloat(t24.PriceChange, 64)
	changePct, _ := strconv.ParseFloat(t24.PriceChangePercent, 64)
	open, _      := strconv.ParseFloat(t24.OpenPrice, 64)
	high, _      := strconv.ParseFloat(t24.HighPrice, 64)
	low, _       := strconv.ParseFloat(t24.LowPrice, 64)
	vol, _       := strconv.ParseFloat(t24.Volume, 64)

	// Klines para historial
	interval := "1d"
	limit := "30"
	if rangeParam == "7d" {
		interval = "1h"; limit = "168"
	} else if rangeParam == "3mo" {
		interval = "1d"; limit = "90"
	} else if rangeParam == "1y" {
		interval = "1w"; limit = "52"
	}

	klinesURL := fmt.Sprintf("%s/api/v3/klines?symbol=%s&interval=%s&limit=%s", baseURL, pair, interval, limit)
	reqK, _ := http.NewRequest(http.MethodGet, klinesURL, nil)
	respK, err := c.http.Do(reqK)
	var history []domain.OHLCPoint
	if err == nil && respK.StatusCode == http.StatusOK {
		var klines klinesResponse
		if json.NewDecoder(respK.Body).Decode(&klines) == nil {
			for _, k := range klines {
				if len(k) < 5 {
					continue
				}
				ts, _ := k[0].(float64)
				closeStr, _ := k[4].(string)
				closeVal, _ := strconv.ParseFloat(closeStr, 64)
				history = append(history, domain.OHLCPoint{
					Timestamp: int64(ts) / 1000,
					Close:     closeVal,
				})
			}
		}
		respK.Body.Close()
	}

	return &domain.AssetDetails{
		Symbol:    symbol,
		Name:      symbol,
		Currency:  "USDT",
		Price:     price,
		Change:    change,
		ChangePct: changePct,
		Open:      open,
		High:      high,
		Low:       low,
		Volume:    int64(vol),
		History:   history,
		Source:    "binance",
	}, nil
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
