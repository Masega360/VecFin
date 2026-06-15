package usecase

import (
	"context"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type DashboardUsecase struct {
	walletRepo      domain.WalletRepository
	assetWalletRepo domain.AssetWalletRepository
	alertRepo       domain.PriceAlertRepository
	followRepo      domain.FollowRepository
	communityRepo   domain.CommunityRepository
	postRepo        domain.PostRepository
	marketUC        *MarketUsecase
	followUC        *FollowUsecase
}

func NewDashboardUsecase(
	walletRepo domain.WalletRepository,
	assetWalletRepo domain.AssetWalletRepository,
	alertRepo domain.PriceAlertRepository,
	followRepo domain.FollowRepository,
	communityRepo domain.CommunityRepository,
	postRepo domain.PostRepository,
	marketUC *MarketUsecase,
	followUC *FollowUsecase,
) *DashboardUsecase {
	return &DashboardUsecase{
		walletRepo:      walletRepo,
		assetWalletRepo: assetWalletRepo,
		alertRepo:       alertRepo,
		followRepo:      followRepo,
		communityRepo:   communityRepo,
		postRepo:        postRepo,
		marketUC:        marketUC,
		followUC:        followUC,
	}
}

func (u *DashboardUsecase) GetDashboard(userID uuid.UUID) (domain.DashboardData, error) {
	return u.buildDashboard(userID, userID)
}

func (u *DashboardUsecase) GetGuestDashboard(viewerID, targetID uuid.UUID) (domain.DashboardData, error) {
	return u.buildDashboard(viewerID, targetID)
}

func (u *DashboardUsecase) buildDashboard(viewerID, targetID uuid.UUID) (domain.DashboardData, error) {
	ctx := context.Background()

	visibility, err := u.followUC.GetProfileVisibility(viewerID, targetID)
	if err != nil {
		return domain.DashboardData{}, err
	}

	status, _ := u.followRepo.CheckStatus(viewerID, targetID)

	followersCount, _ := u.followRepo.CountFollowers(targetID, domain.FollowStatusApproved)
	followingCount, _ := u.followRepo.CountFollowing(targetID, domain.FollowStatusApproved)

	dashboard := domain.DashboardData{
		UserID:         targetID,
		FollowersCount: followersCount,
		FollowingCount: followingCount,
		FollowStatus:   status,
		Holdings:       make([]domain.HoldingInfo, 0),
	}

	if visibility.CanSeeWallets {
		wallets, err := u.walletRepo.ListByUser(ctx, targetID)
		if err == nil {
			var totalValue, dayChange float64
			var topPerformer, worstPerformer *domain.PerformerInfo
			assetMap := make(map[string]float64)

			for _, w := range wallets {
				assets, _ := u.assetWalletRepo.ListByWallet(ctx, w.ID)
				for _, a := range assets {
					assetMap[a.Ticker] += a.Quantity
				}
			}

			for ticker, qty := range assetMap {
				details, err := u.marketUC.GetAssetDetails(ticker, "1d")
				if err != nil || details == nil {
					continue
				}

				value := qty * details.Price
				totalValue += value
				dayChange += qty * details.Change

				dashboard.Holdings = append(dashboard.Holdings, domain.HoldingInfo{
					Symbol:    ticker,
					Name:      details.Name,
					Value:     value,
					ChangePct: details.ChangePct,
				})

				if topPerformer == nil || details.ChangePct > topPerformer.ChangePct {
					topPerformer = &domain.PerformerInfo{Symbol: ticker, Name: details.Name, ChangePct: details.ChangePct}
				}
				if worstPerformer == nil || details.ChangePct < worstPerformer.ChangePct {
					worstPerformer = &domain.PerformerInfo{Symbol: ticker, Name: details.Name, ChangePct: details.ChangePct}
				}
			}

			for i := range dashboard.Holdings {
				if totalValue > 0 {
					dashboard.Holdings[i].Percentage = (dashboard.Holdings[i].Value / totalValue) * 100
				}
			}

			dayChangePct := 0.0
			if totalValue-dayChange != 0 {
				dayChangePct = (dayChange / (totalValue - dayChange)) * 100
			}

			dashboard.TotalValue = totalValue
			dashboard.TotalGain = dayChange
			dashboard.TotalGainPct = dayChangePct
			dashboard.DayChange = dayChange
			dashboard.DayChangePct = dayChangePct
			dashboard.TopPerformer = topPerformer
			dashboard.WorstPerformer = worstPerformer
			dashboard.TotalWallets = len(wallets)
			dashboard.TotalAssets = len(assetMap)
		}
	}

	if visibility.CanSeeCommunities {
		commCount, _ := u.communityRepo.CountByUserID(targetID)
		dashboard.CommunityCount = commCount
	}

	if visibility.CanSeePosts {
		postCount, _ := u.postRepo.CountByUserID(targetID)
		dashboard.PostCount = postCount
	}

	return dashboard, nil
}
