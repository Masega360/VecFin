package usecase

import (
	"context"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

// hotTopics son temas de mercado hardcodeados por ahora.
// En el futuro se pueden obtener de un feed de noticias o API de tendencias.
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

type RecommendationUsecase struct {
	ai          domain.AIProvider
	users       recUserRepository
	wallets     recWalletRepository
	assetWallet recAssetWalletRepository
}

func NewRecommendationUsecase(
	ai domain.AIProvider,
	users recUserRepository,
	wallets recWalletRepository,
	assetWallet recAssetWalletRepository,
) *RecommendationUsecase {
	return &RecommendationUsecase{ai: ai, users: users, wallets: wallets, assetWallet: assetWallet}
}

func (uc *RecommendationUsecase) Get(ctx context.Context, userID uuid.UUID) ([]domain.Recommendation, error) {
	user, err := uc.users.FindByID(userID)
	if err != nil {
		return nil, err
	}

	wallets, err := uc.wallets.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Recolectar tickers únicos de todas las wallets
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

	return uc.ai.GetRecommendations(ctx, domain.RecommendationInput{
		RiskType:  user.RiskType,
		Holdings:  holdings,
		HotTopics: hotTopics,
	})
}
