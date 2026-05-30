package usecase

import (
	"context"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type FiscalReportUsecase struct {
	userRepo        domain.UserRepository
	walletRepo      domain.WalletRepository
	assetWalletRepo domain.AssetWalletRepository
	marketUC        *MarketUsecase
	pdfGen          domain.PDFGenerator
	tokenRepo       domain.TokenUsageRepository
}

func NewFiscalReportUsecase(
	userRepo domain.UserRepository,
	walletRepo domain.WalletRepository,
	assetWalletRepo domain.AssetWalletRepository,
	marketUC *MarketUsecase,
	pdfGen domain.PDFGenerator,
	tokenRepo domain.TokenUsageRepository,
) *FiscalReportUsecase {
	return &FiscalReportUsecase{
		userRepo:        userRepo,
		walletRepo:      walletRepo,
		assetWalletRepo: assetWalletRepo,
		marketUC:        marketUC,
		pdfGen:          pdfGen,
		tokenRepo:       tokenRepo,
	}
}

func (u *FiscalReportUsecase) Generate(userID uuid.UUID) ([]byte, error) {
	ctx := context.Background()

	user, err := u.userRepo.FindByID(userID)
	if err != nil {
		return nil, err
	}

	wallets, err := u.walletRepo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	var lines []domain.FiscalReportLine
	var total float64

	for _, w := range wallets {
		assets, err := u.assetWalletRepo.ListByWallet(ctx, w.ID)
		if err != nil {
			continue
		}
		for _, a := range assets {
			details, err := u.marketUC.GetAssetDetails(a.Ticker, "1d")
			if err != nil || details == nil {
				continue
			}
			lineTotal := a.Quantity * details.Price
			lines = append(lines, domain.FiscalReportLine{
				Ticker:     a.Ticker,
				Name:       details.Name,
				Quantity:   a.Quantity,
				PriceUSD:   details.Price,
				TotalUSD:   lineTotal,
				WalletName: w.Name,
			})
			total += lineTotal
		}
	}

	report := domain.FiscalReport{
		UserName:    user.FirstName + " " + user.LastName,
		Email:       user.Email,
		GeneratedAt: time.Now(),
		Lines:       lines,
		TotalUSD:    total,
	}

	aiUsage, _ := u.tokenRepo.GetMonthly(ctx, userID)
	report.AIUsage = aiUsage

	return u.pdfGen.GenerateFiscalReport(report)
}
