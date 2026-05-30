package usecase

import (
	"context"
	"strings"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

const recommendationTTL = time.Hour

type newsProvider interface {
	HotTopics() []string
	HeadlinesByQuery(query string) []domain.News
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

type recFavRepository interface {
	ListFavorites(userID uuid.UUID) ([]domain.FavAsset, error)
}

type recChatRepository interface {
	ListSessions(ctx context.Context, userID uuid.UUID) ([]domain.ChatSession, error)
}

type RecommendationUsecase struct {
	ai          domain.AIProvider
	users       recUserRepository
	wallets     recWalletRepository
	assetWallet recAssetWalletRepository
	cache       recCacheRepository
	news        newsProvider
	favs        recFavRepository
	chats       recChatRepository
}

func NewRecommendationUsecase(
	ai domain.AIProvider,
	users recUserRepository,
	wallets recWalletRepository,
	assetWallet recAssetWalletRepository,
	cache recCacheRepository,
	news newsProvider,
	favs recFavRepository,
	chats recChatRepository,
) *RecommendationUsecase {
	return &RecommendationUsecase{ai: ai, users: users, wallets: wallets, assetWallet: assetWallet, cache: cache, news: news, favs: favs, chats: chats}
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
		HotTopics: uc.buildPersonalizedTopics(ctx, userID, holdings),
	})
	if err != nil {
		return nil, err
	}

	_ = uc.cache.Upsert(ctx, domain.RecommendationCache{UserID: userID, Data: recs})
	return recs, nil
}


func (uc *RecommendationUsecase) buildPersonalizedTopics(ctx context.Context, userID uuid.UUID, holdings []string) []string {
	// Collect all queries: holdings + favorites + recent chat topics
	queries := make(map[string]bool)
	for _, h := range holdings {
		if idx := strings.IndexAny(h, "-"); idx > 0 {
			queries[h[:idx]] = true
		} else {
			queries[h] = true
		}
	}

	// Add favorites
	if favs, err := uc.favs.ListFavorites(userID); err == nil {
		for _, f := range favs {
			ticker := f.AssetID
			if idx := strings.IndexAny(ticker, "-"); idx > 0 {
				ticker = ticker[:idx]
			}
			queries[ticker] = true
		}
	}

	// Add recent chat session titles as topics (last 5)
	if sessions, err := uc.chats.ListSessions(ctx, userID); err == nil {
		for i, s := range sessions {
			if i >= 5 {
				break
			}
			if s.Title != "Nueva conversación" {
				queries[s.Title] = true
			}
		}
	}

	// Fetch news for each query
	seen := map[string]bool{}
	var topics []string
	for q := range queries {
		news := uc.news.HeadlinesByQuery(q)
		for _, n := range news {
			if !seen[n.Title] && len(topics) < 10 {
				seen[n.Title] = true
				topics = append(topics, n.Title)
			}
		}
	}

	// Fallback to generic if nothing found
	if len(topics) == 0 {
		return uc.news.HotTopics()
	}
	return topics
}
