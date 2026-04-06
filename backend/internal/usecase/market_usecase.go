package usecase

import (
	"fmt"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type MarketUsecase struct {
	market domain.MarketService
	repo   domain.AssetRepository
}

func NewMarketUsecase(market domain.MarketService, repo domain.AssetRepository) *MarketUsecase {
	return &MarketUsecase{market: market, repo: repo}
}

func (u *MarketUsecase) SearchAssets(query string) ([]domain.Asset, error) {
	return u.market.SearchAssets(query)
}

func (u *MarketUsecase) GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error) {
	return u.market.GetAssetDetails(symbol, rangeParam)
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
