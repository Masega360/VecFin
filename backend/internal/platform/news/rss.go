package news

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

const defaultRSSURL = "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnpHZ0pCVWlnQVAB?hl=es-419&gl=AR&ceid=AR:es-419"

type rssResponse struct {
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title   string `xml:"title"`
	Link    string `xml:"link"`
	PubDate string `xml:"pubDate"`
	Source  string `xml:"source"`
}

type Client struct {
	url    string
	client *http.Client
}

func NewClient(url string) *Client {
	if url == "" {
		url = defaultRSSURL
	}
	return &Client{url: url, client: &http.Client{Timeout: 10 * time.Second}}
}

func (c *Client) FetchHeadlines(limit int) ([]domain.News, error) {
	resp, err := c.client.Get(c.url)
	if err != nil {
		return nil, fmt.Errorf("news rss: %w", err)
	}
	defer resp.Body.Close()

	var rss rssResponse
	if err := xml.NewDecoder(resp.Body).Decode(&rss); err != nil {
		return nil, fmt.Errorf("news rss parse: %w", err)
	}

	items := rss.Channel.Items
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}

	news := make([]domain.News, 0, len(items))
	for _, item := range items {
		pub, _ := time.Parse(time.RFC1123Z, item.PubDate)
		news = append(news, domain.News{
			Title:       item.Title,
			URL:         item.Link,
			Source:      item.Source,
			PublishedAt: pub,
		})
	}
	return news, nil
}
