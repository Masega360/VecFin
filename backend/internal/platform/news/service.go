package news

import (
	"log"
	"sync"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

const cacheTTL = 30 * time.Minute

// Service provee noticias financieras con cache en memoria.
type Service struct {
	client    *Client
	mu        sync.RWMutex
	cached    []domain.News
	updatedAt time.Time
}

func NewService(client *Client) *Service {
	return &Service{client: client}
}

// Headlines devuelve las últimas noticias (cacheadas).
func (s *Service) Headlines() []domain.News {
	s.mu.RLock()
	if time.Since(s.updatedAt) < cacheTTL && len(s.cached) > 0 {
		defer s.mu.RUnlock()
		return s.cached
	}
	s.mu.RUnlock()

	s.mu.Lock()
	defer s.mu.Unlock()

	// Double-check after acquiring write lock
	if time.Since(s.updatedAt) < cacheTTL && len(s.cached) > 0 {
		return s.cached
	}

	headlines, err := s.client.FetchHeadlines(10)
	if err != nil {
		log.Printf("[news] error fetching headlines: %v", err)
		return s.cached // return stale if available
	}
	s.cached = headlines
	s.updatedAt = time.Now()
	return s.cached
}

// HotTopics devuelve los títulos de las noticias como strings para usar en prompts.
func (s *Service) HotTopics() []string {
	headlines := s.Headlines()
	topics := make([]string, 0, len(headlines))
	for _, h := range headlines {
		topics = append(topics, h.Title)
	}
	return topics
}
