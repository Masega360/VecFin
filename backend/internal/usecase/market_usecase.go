package usecase

import (
	"fmt"
	"sync"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type MarketUsecase struct {
	providers []domain.MarketProvider
	repo      domain.AssetRepository
}

func NewMarketUsecase(repo domain.AssetRepository, providers ...domain.MarketProvider) *MarketUsecase {
	return &MarketUsecase{providers: providers, repo: repo}
}

// SearchAssets busca en todos los providers en paralelo y mergea los resultados.
func (u *MarketUsecase) SearchAssets(query string) ([]domain.Asset, error) {
	type result struct {
		assets []domain.Asset
		err    error
	}

	results := make([]result, len(u.providers))
	var wg sync.WaitGroup
	for i, p := range u.providers {
		wg.Add(1)
		go func(idx int, provider domain.MarketProvider) {
			defer wg.Done()
			assets, err := provider.SearchAssets(query)
			results[idx] = result{assets, err}
		}(i, p)
	}
	wg.Wait()

	// Mergear: Yahoo primero, luego el resto. Deduplicar por Symbol+Source.
	seen := make(map[string]bool)
	var merged []domain.Asset
	for _, r := range results {
		if r.err != nil {
			continue
		}
		for _, a := range r.assets {
			key := a.Symbol + "|" + a.Source
			if !seen[key] {
				seen[key] = true
				merged = append(merged, a)
			}
		}
	}
	return merged, nil
}

// GetAssetDetails intenta con cada provider en orden hasta obtener resultado.
func (u *MarketUsecase) GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error) {
	type result struct {
		details *domain.AssetDetails
		err     error
	}

	results := make([]result, len(u.providers))
	var wg sync.WaitGroup
	for i, p := range u.providers {
		wg.Add(1)
		go func(idx int, provider domain.MarketProvider) {
			defer wg.Done()
			d, err := provider.GetAssetDetails(symbol, rangeParam)
			results[idx] = result{d, err}
		}(i, p)
	}
	wg.Wait()

	// Devolver el primer resultado exitoso (Yahoo tiene prioridad por ser el primero)
	for _, r := range results {
		if r.err == nil && r.details != nil {
			return r.details, nil
		}
	}
	return nil, domain.ErrAssetNotFound
}

func (u *MarketUsecase) AddFavorite(userID, assetID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("user_id inválido")
	}
	return u.repo.AddFavorite(uid, assetID)
}

func (u *MarketUsecase) RemoveFavorite(userID, assetID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("user_id inválido")
	}
	return u.repo.RemoveFavorite(uid, assetID)
}

func (u *MarketUsecase) ListFavorites(userID string) ([]domain.FavAsset, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("user_id inválido")
	}
	return u.repo.ListFavorites(uid)
}
