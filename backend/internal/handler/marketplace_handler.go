package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type MarketplaceHandler struct {
	db     *sql.DB
	market domain.MarketService
}

func NewMarketplaceHandler(db *sql.DB, market domain.MarketService) *MarketplaceHandler {
	return &MarketplaceHandler{db: db, market: market}
}

func (h *MarketplaceHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /marketplace", auth(h.ListPool))
	http.HandleFunc("POST /marketplace/buy", auth(h.Buy))
	http.HandleFunc("POST /marketplace/sell", auth(h.Sell))
}

type PoolItem struct {
	Ticker   string  `json:"ticker"`
	Quantity float64 `json:"quantity"`
	PriceUSD float64 `json:"price_usd"`
}

// ListPool devuelve los tickers disponibles en el pozo con su precio actual
func (h *MarketplaceHandler) ListPool(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `SELECT ticker, quantity FROM market_pool WHERE quantity > 0 ORDER BY ticker`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var items []PoolItem
	for rows.Next() {
		var p PoolItem
		rows.Scan(&p.Ticker, &p.Quantity)
		if d, err := h.market.GetAssetDetails(p.Ticker, "1d"); err == nil && d != nil {
			p.PriceUSD = d.Price
		}
		items = append(items, p)
	}
	if items == nil {
		items = []PoolItem{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// Buy: usuario compra ticker del pozo pagando con otro ticker de su wallet
// Body: { "wallet_id", "ticker": "BTC-USD", "quantity": 0.5, "pay_ticker": "ETH-USD" }
func (h *MarketplaceHandler) Buy(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	var body struct {
		WalletID  string  `json:"wallet_id"`
		Ticker    string  `json:"ticker"`
		Quantity  float64 `json:"quantity"`
		PayTicker string  `json:"pay_ticker"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Ticker == "" || body.Quantity <= 0 || body.PayTicker == "" {
		http.Error(w, "datos inválidos", http.StatusBadRequest)
		return
	}

	walletID, err := uuid.Parse(body.WalletID)
	if err != nil {
		http.Error(w, "wallet_id inválido", http.StatusBadRequest)
		return
	}

	// Verificar que el user es miembro con permisos
	var role string
	err = h.db.QueryRowContext(r.Context(), `SELECT role FROM wallet_member WHERE wallet_id=$1 AND user_id=$2`, walletID, userID).Scan(&role)
	if err != nil || (role != "owner" && role != "admin") {
		http.Error(w, "sin permisos en esta wallet", http.StatusForbidden)
		return
	}

	// Obtener precios
	buyDetails, err := h.market.GetAssetDetails(body.Ticker, "1d")
	if err != nil || buyDetails == nil {
		http.Error(w, "no se pudo obtener precio de "+body.Ticker, http.StatusBadRequest)
		return
	}
	payDetails, err := h.market.GetAssetDetails(body.PayTicker, "1d")
	if err != nil || payDetails == nil {
		http.Error(w, "no se pudo obtener precio de "+body.PayTicker, http.StatusBadRequest)
		return
	}

	totalUSD := body.Quantity * buyDetails.Price
	payQuantity := totalUSD / payDetails.Price

	// Verificar stock en pozo
	var poolQty float64
	h.db.QueryRowContext(r.Context(), `SELECT quantity FROM market_pool WHERE ticker=$1`, body.Ticker).Scan(&poolQty)
	if poolQty < body.Quantity {
		http.Error(w, "stock insuficiente en el pozo", http.StatusBadRequest)
		return
	}

	// Verificar que el user tiene suficiente pay_ticker
	var userPayQty float64
	h.db.QueryRowContext(r.Context(), `SELECT quantity FROM asset_wallet WHERE wallet_id=$1 AND ticker=$2`, walletID, body.PayTicker).Scan(&userPayQty)
	if userPayQty < payQuantity {
		http.Error(w, "saldo insuficiente de "+body.PayTicker, http.StatusBadRequest)
		return
	}

	// Ejecutar: descontar pozo, acreditar user, descontar pago del user, acreditar pago al pozo
	tx, _ := h.db.BeginTx(r.Context(), nil)
	tx.ExecContext(r.Context(), `UPDATE market_pool SET quantity = quantity - $1 WHERE ticker = $2`, body.Quantity, body.Ticker)
	tx.ExecContext(r.Context(), `INSERT INTO asset_wallet (wallet_id, ticker, quantity) VALUES ($1,$2,$3) ON CONFLICT (wallet_id, ticker) DO UPDATE SET quantity = asset_wallet.quantity + $3`, walletID, body.Ticker, body.Quantity)
	tx.ExecContext(r.Context(), `UPDATE asset_wallet SET quantity = quantity - $1 WHERE wallet_id=$2 AND ticker=$3`, payQuantity, walletID, body.PayTicker)
	tx.ExecContext(r.Context(), `INSERT INTO market_pool (ticker, quantity) VALUES ($1,$2) ON CONFLICT (ticker) DO UPDATE SET quantity = market_pool.quantity + $2`, body.PayTicker, payQuantity)
	tx.ExecContext(r.Context(), `INSERT INTO market_trade (user_id, wallet_id, side, ticker, quantity, price_usd, total_usd, pay_ticker, pay_quantity) VALUES ($1,$2,'buy',$3,$4,$5,$6,$7,$8)`,
		userID, walletID, body.Ticker, body.Quantity, buyDetails.Price, totalUSD, body.PayTicker, payQuantity)
	tx.ExecContext(r.Context(), `INSERT INTO transfer (from_wallet_id, to_wallet_id, ticker, quantity, note, created_by) VALUES ($1,$1,$2,$3,$4,$5)`,
		walletID, body.Ticker, body.Quantity, fmt.Sprintf("Compra en marketplace: pagó %.4f %s", payQuantity, body.PayTicker), userID)
	tx.Commit()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"total_usd": totalUSD, "paid": payQuantity, "pay_ticker": body.PayTicker})
}

// Sell: usuario vende ticker al pozo, recibe USDT equivalente
// Body: { "wallet_id", "ticker": "SOL-USD", "quantity": 10 }
func (h *MarketplaceHandler) Sell(w http.ResponseWriter, r *http.Request) {
	userID, err := userIDFromContext(r)
	if err != nil {
		http.Error(w, "no autorizado", http.StatusUnauthorized)
		return
	}

	var body struct {
		WalletID string  `json:"wallet_id"`
		Ticker   string  `json:"ticker"`
		Quantity float64 `json:"quantity"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Ticker == "" || body.Quantity <= 0 {
		http.Error(w, "datos inválidos", http.StatusBadRequest)
		return
	}

	walletID, err := uuid.Parse(body.WalletID)
	if err != nil {
		http.Error(w, "wallet_id inválido", http.StatusBadRequest)
		return
	}

	// Verificar permisos
	var role string
	err = h.db.QueryRowContext(r.Context(), `SELECT role FROM wallet_member WHERE wallet_id=$1 AND user_id=$2`, walletID, userID).Scan(&role)
	if err != nil || (role != "owner" && role != "admin") {
		http.Error(w, "sin permisos en esta wallet", http.StatusForbidden)
		return
	}

	// Precio
	details, err := h.market.GetAssetDetails(body.Ticker, "1d")
	if err != nil || details == nil {
		http.Error(w, "no se pudo obtener precio", http.StatusBadRequest)
		return
	}
	totalUSD := body.Quantity * details.Price

	// Verificar que tiene el asset
	var userQty float64
	h.db.QueryRowContext(r.Context(), `SELECT quantity FROM asset_wallet WHERE wallet_id=$1 AND ticker=$2`, walletID, body.Ticker).Scan(&userQty)
	if userQty < body.Quantity {
		http.Error(w, "saldo insuficiente", http.StatusBadRequest)
		return
	}

	// Ejecutar: descontar user, acreditar pozo, dar USDT al user
	tx, _ := h.db.BeginTx(r.Context(), nil)
	tx.ExecContext(r.Context(), `UPDATE asset_wallet SET quantity = quantity - $1 WHERE wallet_id=$2 AND ticker=$3`, body.Quantity, walletID, body.Ticker)
	tx.ExecContext(r.Context(), `INSERT INTO market_pool (ticker, quantity) VALUES ($1,$2) ON CONFLICT (ticker) DO UPDATE SET quantity = market_pool.quantity + $2`, body.Ticker, body.Quantity)
	tx.ExecContext(r.Context(), `INSERT INTO asset_wallet (wallet_id, ticker, quantity) VALUES ($1,'USDT',$2) ON CONFLICT (wallet_id, ticker) DO UPDATE SET quantity = asset_wallet.quantity + $2`, walletID, totalUSD)
	tx.ExecContext(r.Context(), `INSERT INTO market_trade (user_id, wallet_id, side, ticker, quantity, price_usd, total_usd, pay_ticker, pay_quantity) VALUES ($1,$2,'sell',$3,$4,$5,$6,'USDT',$6)`,
		userID, walletID, body.Ticker, body.Quantity, details.Price, totalUSD)
	tx.ExecContext(r.Context(), `INSERT INTO transfer (from_wallet_id, to_wallet_id, ticker, quantity, note, created_by) VALUES ($1,$1,$2,$3,$4,$5)`,
		walletID, body.Ticker, body.Quantity, fmt.Sprintf("Venta en marketplace: recibió %.2f USDT", totalUSD), userID)
	tx.Commit()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"total_usd": totalUSD, "received_usdt": totalUSD})
}
