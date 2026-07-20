package iol

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

const baseURL = "https://api.invertironline.com"

// Client implementa domain.ExchangeService y domain.MarketProvider para IOL (InvertirOnline).
type Client struct {
	http *http.Client
}

func NewClient() *Client {
	return &Client{http: &http.Client{Timeout: 15 * time.Second}}
}

func (c *Client) Name() string { return "iol" }

// ─── AUTH ─────────────────────────────────────────────────────────────────────

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
}

// authenticate obtiene un access_token usando username/password de IOL.
func (c *Client) authenticate(username, password string) (string, error) {
	data := url.Values{}
	data.Set("username", username)
	data.Set("password", password)
	data.Set("grant_type", "password")

	req, err := http.NewRequest(http.MethodPost, baseURL+"/token", strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("iol auth: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("iol auth: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("iol auth: status %d (credenciales inválidas)", resp.StatusCode)
	}

	var tok tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return "", fmt.Errorf("iol auth decode: %w", err)
	}
	return tok.AccessToken, nil
}

// ─── GetHoldings (ExchangeService) ───────────────────────────────────────────

// Respuesta del endpoint GET /api/v2/portafolio/{pais}
type portafolioResponse struct {
	Activos []activoPortafolio `json:"activos"`
}

type activoPortafolio struct {
	Titulo   tituloInfo `json:"titulo"`
	Cantidad float64    `json:"cantidad"`
}

type tituloInfo struct {
	Simbolo     string `json:"simbolo"`
	Descripcion string `json:"descripcion"`
	Tipo        string `json:"tipo"`
	Mercado     string `json:"mercado"`
}

// GetHoldings implementa domain.ExchangeService.
// apiKey = username IOL, apiSecret = password IOL.
func (c *Client) GetHoldings(apiKey, apiSecret string) ([]domain.ExchangeHolding, error) {
	token, err := c.authenticate(apiKey, apiSecret)
	if err != nil {
		return nil, err
	}

	holdings, err := c.getPortafolio(token, "argentina")
	if err != nil {
		return nil, err
	}

	// También traemos portafolio de estados_unidos si el usuario opera CEDEARs/ADRs
	holdingsUS, err := c.getPortafolio(token, "estados_Unidos")
	if err == nil {
		holdings = append(holdings, holdingsUS...)
	}

	return holdings, nil
}

func (c *Client) getPortafolio(token, pais string) ([]domain.ExchangeHolding, error) {
	reqURL := fmt.Sprintf("%s/api/v2/portafolio/%s", baseURL, pais)
	req, err := http.NewRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("iol portafolio: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("iol portafolio: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("iol portafolio %s: status %d", pais, resp.StatusCode)
	}

	var portafolio portafolioResponse
	if err := json.NewDecoder(resp.Body).Decode(&portafolio); err != nil {
		return nil, fmt.Errorf("iol portafolio decode: %w", err)
	}

	var holdings []domain.ExchangeHolding
	for _, a := range portafolio.Activos {
		if a.Cantidad > 0 {
			holdings = append(holdings, domain.ExchangeHolding{
				Ticker:   a.Titulo.Simbolo,
				Quantity: a.Cantidad,
			})
		}
	}
	return holdings, nil
}

// ─── SearchAssets (MarketProvider) ────────────────────────────────────────────

// cotizacionItem es un título del panel de cotizaciones de IOL.
type cotizacionItem struct {
	Simbolo             string  `json:"simbolo"`
	Descripcion         string  `json:"descripcion"`
	UltimoPrecio        float64 `json:"ultimoPrecio"`
	VariacionPorcentual float64 `json:"variacionPorcentual"`
	Tipo                string  `json:"tipo"`
}

// SearchAssets busca activos en el panel de líderes de BCBA.
func (c *Client) SearchAssets(query string) ([]domain.Asset, error) {
	// IOL no tiene un endpoint de búsqueda libre. Usamos el panel de cotizaciones
	// y filtramos por query. Paneles comunes: "lideres", "general", "cedears"
	panels := []struct {
		instrumento string
		panel       string
		pais        string
		assetType   string
	}{
		{"acciones", "lideres", "argentina", "ACCION"},
		{"acciones", "general", "argentina", "ACCION"},
		{"cedpiola", "cedears", "argentina", "CEDEAR"},
	}

	q := strings.ToUpper(query)
	var results []domain.Asset

	for _, p := range panels {
		reqURL := fmt.Sprintf("%s/api/v2/Cotizaciones/%s/%s/%s", baseURL, p.instrumento, p.panel, p.pais)
		req, err := http.NewRequest(http.MethodGet, reqURL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Accept", "application/json")

		resp, err := c.http.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}

		var items struct {
			Titulos []cotizacionItem `json:"titulos"`
		}
		if json.NewDecoder(resp.Body).Decode(&items) == nil {
			for _, t := range items.Titulos {
				if strings.Contains(strings.ToUpper(t.Simbolo), q) ||
					strings.Contains(strings.ToUpper(t.Descripcion), q) {
					results = append(results, domain.Asset{
						Symbol: t.Simbolo,
						Name:   t.Descripcion,
						Type:   p.assetType,
						Source: "iol",
					})
				}
			}
		}
		resp.Body.Close()

		if len(results) >= 10 {
			break
		}
	}

	// Deduplicar por símbolo
	seen := make(map[string]bool, len(results))
	deduped := results[:0]
	for _, r := range results {
		if !seen[r.Symbol] {
			seen[r.Symbol] = true
			deduped = append(deduped, r)
		}
	}

	if len(deduped) > 10 {
		deduped = deduped[:10]
	}
	return deduped, nil
}

// ─── GetAssetDetails (MarketProvider) ─────────────────────────────────────────

type cotizacionDetalle struct {
	UltimoPrecio             float64 `json:"ultimoPrecio"`
	VariacionPorcentual      float64 `json:"variacionPorcentual"`
	Apertura                 float64 `json:"apertura"`
	Maximo                   float64 `json:"maximo"`
	Minimo                   float64 `json:"minimo"`
	VolumenNominal           int64   `json:"volumenNominal"`
	Descripcion              string  `json:"descripcion"`
	Moneda                   string  `json:"moneda"`
	CantidadOperaciones      int     `json:"cantidadOperaciones"`
	PrecioAnterior           float64 `json:"precioAnterior"`
}

func (c *Client) GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error) {
	// Intentamos en BCBA primero (mercado argentino principal)
	mercados := []string{"bCBA", "nYSE", "nASDAQ"}

	for _, mercado := range mercados {
		reqURL := fmt.Sprintf("%s/api/v2/%s/Titulos/%s/Cotizacion", baseURL, mercado, strings.ToUpper(symbol))
		req, err := http.NewRequest(http.MethodGet, reqURL, nil)
		if err != nil {
			continue
		}
		req.Header.Set("Accept", "application/json")

		resp, err := c.http.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}

		var det cotizacionDetalle
		if err := json.NewDecoder(resp.Body).Decode(&det); err != nil {
			resp.Body.Close()
			continue
		}
		resp.Body.Close()

		if det.UltimoPrecio == 0 {
			continue
		}

		change := det.UltimoPrecio - det.PrecioAnterior
		currency := "ARS"
		if det.Moneda != "" {
			currency = det.Moneda
		}

		return &domain.AssetDetails{
			Symbol:    symbol,
			Name:      det.Descripcion,
			Currency:  currency,
			Price:     det.UltimoPrecio,
			Change:    change,
			ChangePct: det.VariacionPorcentual,
			Open:      det.Apertura,
			High:      det.Maximo,
			Low:       det.Minimo,
			Volume:    det.VolumenNominal,
			History:   nil, // IOL no provee historial en este endpoint
			Source:    "iol",
		}, nil
	}

	return nil, domain.ErrAssetNotFound
}
