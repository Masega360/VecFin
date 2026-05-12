package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type newsService interface {
	Headlines() []domain.News
}

type NewsHandler struct {
	news newsService
}

func NewNewsHandler(news newsService) *NewsHandler {
	return &NewsHandler{news: news}
}

func (h *NewsHandler) RegisterRoutes(jwtSecret string) {
	http.HandleFunc("GET /news", h.GetNews)
}

func (h *NewsHandler) GetNews(w http.ResponseWriter, r *http.Request) {
	headlines := h.news.Headlines()
	if headlines == nil {
		headlines = []domain.News{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(headlines)
}
