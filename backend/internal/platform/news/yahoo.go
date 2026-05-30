package news

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type yahooNewsResponse struct {
	News []yahooNewsItem `json:"news"`
}

type yahooNewsItem struct {
	UUID                string         `json:"uuid"`
	Title               string         `json:"title"`
	Publisher           string         `json:"publisher"`
	Link                string         `json:"link"`
	ProviderPublishTime int64          `json:"providerPublishTime"`
	Thumbnail           *yahooThumb    `json:"thumbnail"`
	RelatedTickers      []string       `json:"relatedTickers"`
}

type yahooThumb struct {
	Resolutions []yahooResolution `json:"resolutions"`
}

type yahooResolution struct {
	URL    string `json:"url"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
	Tag    string `json:"tag"`
}

type Client struct {
	query  string
	client *http.Client
}

func NewClient(query string) *Client {
	if query == "" {
		query = "finance markets crypto"
	}
	return &Client{query: query, client: &http.Client{Timeout: 10 * time.Second}}
}

func (c *Client) FetchHeadlines(limit int) ([]domain.News, error) {
	if limit <= 0 {
		limit = 10
	}

	params := url.Values{}
	params.Set("q", c.query)
	params.Set("newsCount", fmt.Sprintf("%d", limit))
	params.Set("quotesCount", "0")
	params.Set("lang", "en-US")

	req, err := http.NewRequest(http.MethodGet, "https://query1.finance.yahoo.com/v1/finance/search?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("news yahoo: %w", err)
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("news yahoo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("news yahoo: status %d", resp.StatusCode)
	}

	var result yahooNewsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("news yahoo parse: %w", err)
	}

	news := make([]domain.News, 0, len(result.News))
	for _, item := range result.News {
		n := domain.News{
			ID:          item.UUID,
			Title:       item.Title,
			URL:         item.Link,
			Source:      item.Publisher,
			PublishedAt: time.Unix(item.ProviderPublishTime, 0),
			Tickers:     item.RelatedTickers,
		}
		if item.Thumbnail != nil && len(item.Thumbnail.Resolutions) > 0 {
			n.ImageURL = item.Thumbnail.Resolutions[0].URL
		}
		news = append(news, n)
	}
	return news, nil
}
