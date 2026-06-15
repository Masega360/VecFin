package cache

import (
	"sync"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type entry struct {
	data      *domain.AssetDetails
	expiresAt time.Time
}

// MarketCache wraps a MarketService with in-memory TTL cache.
type MarketCache struct {
	inner domain.MarketService
	ttl   time.Duration
	mu    sync.RWMutex
	store map[string]entry
}

func NewMarketCache(inner domain.MarketService, ttl time.Duration) *MarketCache {
	return &MarketCache{
		inner: inner,
		ttl:   ttl,
		store: make(map[string]entry),
	}
}

func (c *MarketCache) SearchAssets(query string) ([]domain.Asset, error) {
	return c.inner.SearchAssets(query)
}

func (c *MarketCache) Name() string {
	type namer interface{ Name() string }
	if n, ok := c.inner.(namer); ok {
		return n.Name()
	}
	return "cached"
}

func (c *MarketCache) GetCurrentPrice(symbol string) (float64, error) {
	d, err := c.GetAssetDetails(symbol, "1d")
	if err != nil {
		return 0, err
	}
	return d.Price, nil
}

func (c *MarketCache) GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error) {
	key := symbol + "|" + rangeParam

	c.mu.RLock()
	if e, ok := c.store[key]; ok && time.Now().Before(e.expiresAt) {
		c.mu.RUnlock()
		return e.data, nil
	}
	c.mu.RUnlock()

	data, err := c.inner.GetAssetDetails(symbol, rangeParam)
	if err != nil {
		return nil, err
	}

	c.mu.Lock()
	c.store[key] = entry{data: data, expiresAt: time.Now().Add(c.ttl)}
	c.mu.Unlock()

	return data, nil
}

// GetMultipleDetails fetches details for multiple symbols in parallel using the cache.
func (c *MarketCache) GetMultipleDetails(symbols []string, rangeParam string) map[string]*domain.AssetDetails {
	results := make(map[string]*domain.AssetDetails, len(symbols))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, s := range symbols {
		wg.Add(1)
		go func(sym string) {
			defer wg.Done()
			d, err := c.GetAssetDetails(sym, rangeParam)
			if err == nil && d != nil {
				mu.Lock()
				results[sym] = d
				mu.Unlock()
			}
		}(s)
	}
	wg.Wait()
	return results
}
