package yahoo

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

const (
	searchURL = "https://query1.finance.yahoo.com/v1/finance/search"
	chartURL  = "https://query1.finance.yahoo.com/v8/finance/chart"
)

type Client struct {
	http *http.Client
}

func NewClient() *Client {
	return &Client{http: &http.Client{}}
}

func (c *Client) Name() string { return "yahoo" }

// ─── Search ──────────────────────────────────────────────────────────────────

type yahooQuote struct {
	Symbol    string `json:"symbol"`
	ShortName string `json:"shortname"`
	LongName  string `json:"longname"`
	QuoteType string `json:"quoteType"`
}

type yahooSearchResponse struct {
	Quotes []yahooQuote `json:"quotes"`
}

func (c *Client) SearchAssets(query string) ([]domain.Asset, error) {
	params := url.Values{}
	params.Set("q", query)
	params.Set("lang", "en-US")
	params.Set("quotesCount", "10")
	params.Set("newsCount", "0")

	req, err := http.NewRequest(http.MethodGet, searchURL+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("yahoo: crear request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("yahoo: ejecutar request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yahoo: status %d", resp.StatusCode)
	}

	var result yahooSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("yahoo: decodificar respuesta: %w", err)
	}

	assets := make([]domain.Asset, 0, len(result.Quotes))
	for _, q := range result.Quotes {
		name := q.ShortName
		if name == "" {
			name = q.LongName
		}
		assets = append(assets, domain.Asset{
			Symbol: q.Symbol,
			Name:   name,
			Type:   q.QuoteType,
			Source: "yahoo",
		})
	}
	return assets, nil
}

// ─── Chart / Details ─────────────────────────────────────────────────────────

type yahooChartResponse struct {
	Chart struct {
		Result []struct {
			Meta struct {
				Symbol                string  `json:"symbol"`
				ShortName             string  `json:"shortName"`
				LongName              string  `json:"longName"`
				Currency              string  `json:"currency"`
				RegularMarketPrice    float64 `json:"regularMarketPrice"`
				ChartPreviousClose    float64 `json:"chartPreviousClose"`
				RegularMarketOpen     float64 `json:"regularMarketOpen"`
				RegularMarketDayHigh  float64 `json:"regularMarketDayHigh"`
				RegularMarketDayLow   float64 `json:"regularMarketDayLow"`
				RegularMarketVolume   int64   `json:"regularMarketVolume"`
				MarketCap             int64   `json:"marketCap"`
			} `json:"meta"`
			Timestamps []int64 `json:"timestamp"`
			Indicators struct {
				Quote []struct {
					Close []float64 `json:"close"`
				} `json:"quote"`
			} `json:"indicators"`
		} `json:"result"`
		Error interface{} `json:"error"`
	} `json:"chart"`
}

// rangeParam acepta: 7d | 1mo | 3mo | 1y
func (c *Client) GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error) {
	if rangeParam == "" {
		rangeParam = "1mo"
	}

	interval := "1d"
	if rangeParam == "7d" {
		interval = "60m"
	} else if rangeParam == "1y" {
		interval = "1wk"
	}

	params := url.Values{}
	params.Set("interval", interval)
	params.Set("range", rangeParam)

	req, err := http.NewRequest(http.MethodGet, chartURL+"/"+symbol+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("yahoo: crear request: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("yahoo: ejecutar request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yahoo: status %d", resp.StatusCode)
	}

	var raw yahooChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("yahoo: decodificar chart: %w", err)
	}

	if len(raw.Chart.Result) == 0 {
		return nil, domain.ErrAssetNotFound
	}

	r := raw.Chart.Result[0]
	m := r.Meta

	name := m.ShortName
	if name == "" {
		name = m.LongName
	}

	prevClose := m.ChartPreviousClose
	change := m.RegularMarketPrice - prevClose
	changePct := 0.0
	if prevClose != 0 {
		changePct = (change / prevClose) * 100
	}

	// Construir historial filtrando nils
	var history []domain.OHLCPoint
	if len(r.Indicators.Quote) > 0 {
		closes := r.Indicators.Quote[0].Close
		for i, ts := range r.Timestamps {
			if i < len(closes) && closes[i] != 0 {
				history = append(history, domain.OHLCPoint{
					Timestamp: ts,
					Close:     closes[i],
				})
			}
		}
	}

	return &domain.AssetDetails{
		Symbol:    m.Symbol,
		Name:      name,
		Currency:  m.Currency,
		Price:     m.RegularMarketPrice,
		Change:    change,
		ChangePct: changePct,
		Open:      m.RegularMarketOpen,
		High:      m.RegularMarketDayHigh,
		Low:       m.RegularMarketDayLow,
		Volume:    m.RegularMarketVolume,
		MarketCap: m.MarketCap,
		History:   history,
		Source:    "yahoo",
	}, nil
}
