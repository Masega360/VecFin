package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/middleware"
)

type LeaderboardHandler struct {
	db *sql.DB
}

func NewLeaderboardHandler(db *sql.DB) *LeaderboardHandler {
	return &LeaderboardHandler{db: db}
}

func (h *LeaderboardHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)
	http.HandleFunc("GET /leaderboard/portfolio", auth(h.TopPortfolio))
	http.HandleFunc("GET /leaderboard/diversified", auth(h.TopDiversified))
	http.HandleFunc("GET /leaderboard/active", auth(h.TopActive))
}

type RankEntry struct {
	Rank      int     `json:"rank"`
	UserID    string  `json:"user_id"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Value     float64 `json:"value"`
	Label     string  `json:"label"`
}

// TopPortfolio - usuarios con más cantidad total de assets (quantity sum)
func (h *LeaderboardHandler) TopPortfolio(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT u.id, u.first_name, u.last_name, COALESCE(SUM(aw.quantity), 0) as total
		FROM users u
		JOIN wallet_member wm ON wm.user_id = u.id AND wm.role = 'owner'
		JOIN asset_wallet aw ON aw.wallet_id = wm.wallet_id
		GROUP BY u.id, u.first_name, u.last_name
		ORDER BY total DESC
		LIMIT 20`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []RankEntry
	rank := 1
	for rows.Next() {
		var e RankEntry
		rows.Scan(&e.UserID, &e.FirstName, &e.LastName, &e.Value)
		e.Rank = rank
		e.Label = "assets totales"
		entries = append(entries, e)
		rank++
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// TopDiversified - usuarios con más tickers distintos
func (h *LeaderboardHandler) TopDiversified(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT u.id, u.first_name, u.last_name, COUNT(DISTINCT aw.ticker) as tickers
		FROM users u
		JOIN wallet_member wm ON wm.user_id = u.id AND wm.role IN ('owner','admin')
		JOIN asset_wallet aw ON aw.wallet_id = wm.wallet_id
		GROUP BY u.id, u.first_name, u.last_name
		ORDER BY tickers DESC
		LIMIT 20`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []RankEntry
	rank := 1
	for rows.Next() {
		var e RankEntry
		rows.Scan(&e.UserID, &e.FirstName, &e.LastName, &e.Value)
		e.Rank = rank
		e.Label = "tickers distintos"
		entries = append(entries, e)
		rank++
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// TopActive - usuarios con más transferencias realizadas
func (h *LeaderboardHandler) TopActive(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `
		SELECT u.id, u.first_name, u.last_name, COUNT(*) as transfers
		FROM users u
		JOIN transfer t ON t.created_by = u.id
		GROUP BY u.id, u.first_name, u.last_name
		ORDER BY transfers DESC
		LIMIT 20`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []RankEntry
	rank := 1
	for rows.Next() {
		var e RankEntry
		rows.Scan(&e.UserID, &e.FirstName, &e.LastName, &e.Value)
		e.Rank = rank
		e.Label = "transferencias"
		entries = append(entries, e)
		rank++
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}
