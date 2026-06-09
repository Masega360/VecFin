package usecase

import (
	"context"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type DashboardUsecase struct {
	walletRepo     domain.WalletRepository
	assetWalletRepo domain.AssetWalletRepository
	alertRepo      domain.PriceAlertRepository
	marketUC       *MarketUsecase
}

func NewDashboardUsecase(
	walletRepo domain.WalletRepository,
	assetWalletRepo domain.AssetWalletRepository,
	alertRepo domain.PriceAlertRepository,
	marketUC *MarketUsecase,
) *DashboardUsecase {
	return &DashboardUsecase{
		walletRepo:      walletRepo,
		assetWalletRepo: assetWalletRepo,
		alertRepo:       alertRepo,
		marketUC:        marketUC,
	}
}

func (u *DashboardUsecase) GetDashboard(userID uuid.UUID) (domain.DashboardData, error) {
	ctx := context.Background()

	wallets, err := u.walletRepo.ListByUser(ctx, userID)
	if err != nil {
		return domain.DashboardData{}, err
	}

	var holdings []domain.HoldingInfo
	var totalValue, dayChange float64
	var topPerformer, worstPerformer *domain.PerformerInfo

	// Agregar assets de todas las wallets
	assetMap := make(map[string]float64) // ticker -> quantity total
	for _, w := range wallets {
		assets, err := u.assetWalletRepo.ListByWallet(ctx, w.ID)
		if err != nil {
			continue
		}
		for _, a := range assets {
			assetMap[a.Ticker] += a.Quantity
		}
	}

	// Obtener precios y calcular métricas
	for ticker, qty := range assetMap {
		details, err := u.marketUC.GetAssetDetails(ticker, "1d")
		if err != nil || details == nil {
			continue
		}

		value := qty * details.Price
		totalValue += value
		dayChange += qty * details.Change

		holdings = append(holdings, domain.HoldingInfo{
			Symbol:    ticker,
			Name:      details.Name,
			Value:     value,
			ChangePct: details.ChangePct,
		})

		// Track top/worst
		if topPerformer == nil || details.ChangePct > topPerformer.ChangePct {
			topPerformer = &domain.PerformerInfo{Symbol: ticker, Name: details.Name, ChangePct: details.ChangePct}
		}
		if worstPerformer == nil || details.ChangePct < worstPerformer.ChangePct {
			worstPerformer = &domain.PerformerInfo{Symbol: ticker, Name: details.Name, ChangePct: details.ChangePct}
		}
	}

	// Calcular porcentajes de distribución
	for i := range holdings {
		if totalValue > 0 {
			holdings[i].Percentage = (holdings[i].Value / totalValue) * 100
		}
	}

	// Day change pct
	dayChangePct := 0.0
	if totalValue-dayChange != 0 {
		dayChangePct = (dayChange / (totalValue - dayChange)) * 100
	}

	// Alertas activas
	alerts, _ := u.alertRepo.GetByUserID(userID)
	activeAlerts := 0
	for _, a := range alerts {
		if a.IsActive {
			activeAlerts++
		}
	}

	return domain.DashboardData{
		TotalValue:     totalValue,
		TotalGain:      dayChange,
		TotalGainPct:   dayChangePct,
		DayChange:      dayChange,
		DayChangePct:   dayChangePct,
		Holdings:       holdings,
		TopPerformer:   topPerformer,
		WorstPerformer: worstPerformer,
		ActiveAlerts:   activeAlerts,
		TotalWallets:   len(wallets),
		TotalAssets:    len(assetMap),
	}, nil
}
