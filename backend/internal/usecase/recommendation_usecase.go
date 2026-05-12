package usecase

import (
	"context"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

const recommendationTTL = time.Hour

// hotTopics son temas de mercado hardcodeados por ahora.
// En el futuro se reemplazarán por un feed de noticias real (domain.News).
var hotTopics = []string{
	"Bitcoin ETF", "inteligencia artificial", "tasas de la Fed",
	"oro como refugio", "acciones tecnológicas",
}

type recUserRepository interface {
	FindByID(id uuid.UUID) (domain.User, error)
}

type recWalletRepository interface {
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error)
}

type recAssetWalletRepository interface {
	ListByWallet(ctx context.Context, walletID uuid.UUID) ([]domain.AssetWallet, error)
}

type recCacheRepository interface {
	Get(ctx context.Context, userID uuid.UUID) (*domain.RecommendationCache, error)
	Upsert(ctx context.Context, cache domain.RecommendationCache) error
}

type RecommendationUsecase struct {
	ai          domain.AIProvider
	users       recUserRepository
	wallets     recWalletRepository
	assetWallet recAssetWalletRepository
	cache       recCacheRepository
}

func NewRecommendationUsecase(
	ai domain.AIProvider,
	users recUserRepository,
	wallets recWalletRepository,
	assetWallet recAssetWalletRepository,
	cache recCacheRepository,
) *RecommendationUsecase {
	return &RecommendationUsecase{ai: ai, users: users, wallets: wallets, assetWallet: assetWallet, cache: cache}
}

// Get devuelve recomendaciones desde cache si tienen menos de 1h, si no las regenera.
func (uc *RecommendationUsecase) Get(ctx context.Context, userID uuid.UUID) ([]domain.Recommendation, error) {
	cached, err := uc.cache.Get(ctx, userID)
	if err != nil {
		return nil, err
	}
	if cached != nil && time.Since(cached.UpdatedAt) < recommendationTTL {
		return cached.Data, nil
	}
	return uc.refresh(ctx, userID)
}

// Refresh fuerza la regeneración ignorando el cache.
func (uc *RecommendationUsecase) Refresh(ctx context.Context, userID uuid.UUID) ([]domain.Recommendation, error) {
	return uc.refresh(ctx, userID)
}

func (uc *RecommendationUsecase) refresh(ctx context.Context, userID uuid.UUID) ([]domain.Recommendation, error) {
	user, err := uc.users.FindByID(userID)
	if err != nil {
		return nil, err
	}

	wallets, err := uc.wallets.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	var holdings []string
	for _, w := range wallets {
		assets, err := uc.assetWallet.ListByWallet(ctx, w.ID)
		if err != nil {
			continue
		}
		for _, a := range assets {
			if !seen[a.Ticker] {
				seen[a.Ticker] = true
				holdings = append(holdings, a.Ticker)
			}
		}
	}

	recs, err := uc.ai.GetRecommendations(ctx, domain.RecommendationInput{
		RiskType:  user.RiskType,
		Holdings:  holdings,
		HotTopics: hotTopics,
	})
	if err != nil {
		return nil, err
	}

	_ = uc.cache.Upsert(ctx, domain.RecommendationCache{UserID: userID, Data: recs})
	return recs, nil
}
