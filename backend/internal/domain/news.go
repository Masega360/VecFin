package domain

import "time"

// News es el DTO para la futura sección de noticias financieras.
// Por ahora no tiene persistencia; se usará cuando se integre un feed real.
type News struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Summary     string    `json:"summary,omitempty"`
	URL         string    `json:"url"`
	ImageURL    string    `json:"image_url,omitempty"`
	Source      string    `json:"source"`
	PublishedAt time.Time `json:"published_at"`
	Tickers     []string  `json:"tickers,omitempty"`
}
