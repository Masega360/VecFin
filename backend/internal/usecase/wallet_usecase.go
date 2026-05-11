package usecase

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type walletRepository interface {
	CreateWallet(ctx context.Context, wallet domain.Wallet) (uuid.UUID, error)
	ReadWallet(ctx context.Context, id uuid.UUID) (domain.Wallet, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error)
	UpdateWallet(ctx context.Context, id uuid.UUID, wallet domain.Wallet) error
	UpdateLastSync(ctx context.Context, id uuid.UUID, t time.Time) error
	DeleteWallet(ctx context.Context, id uuid.UUID) error
}

// ErrInvalidQuantity se devuelve cuando la cantidad no es estrictamente positiva.
var ErrInvalidQuantity = errors.New("cantidad inválida: debe ser mayor a cero")

// ErrInvalidTicker se devuelve cuando el ticker es vacío.
var ErrInvalidTicker = errors.New("ticker inválido: no puede estar vacío")

type platformRepository interface {
	GetByID(id string) (*domain.Platform, error)
}

type WalletsUseCase struct {
	repo         walletRepository
	assetsRepo   domain.AssetWalletRepository
	market       domain.MarketService
	platformRepo platformRepository
	// exchanges mapea el nombre de la plataforma (lowercase) a su ExchangeService.
	// Ej: "binance" -> *binance.Client
	exchanges map[string]domain.ExchangeService
}

// NewWalletsUseCase construye el usecase. assetsRepo y market pueden ser nil
// si el caller no necesita operaciones sobre assets.
func NewWalletsUseCase(
	repo walletRepository,
	assetsRepo domain.AssetWalletRepository,
	market domain.MarketService,
	platformRepo platformRepository,
	exchanges map[string]domain.ExchangeService,
) *WalletsUseCase {
	return &WalletsUseCase{
		repo:         repo,
		assetsRepo:   assetsRepo,
		market:       market,
		platformRepo: platformRepo,
		exchanges:    exchanges,
	}
}

func (uc *WalletsUseCase) Create(ctx context.Context, wallet domain.Wallet) (uuid.UUID, error) {
	return uc.repo.CreateWallet(ctx, wallet)
}

func (uc *WalletsUseCase) ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error) {
	return uc.repo.ListByUser(ctx, userID)
}

// Read devuelve la wallet solo si pertenece al usuario del token.
func (uc *WalletsUseCase) Read(ctx context.Context, id, userID uuid.UUID) (domain.Wallet, error) {
	wallet, err := uc.repo.ReadWallet(ctx, id)
	if err != nil {
		return domain.Wallet{}, err
	}
	if wallet.UserID != userID {
		return domain.Wallet{}, domain.ErrForbidden
	}
	return wallet, nil
}

// Update aplica cambios manuales del usuario (nombre y/o credenciales).
// Solo actualiza los campos que vengan con valor en `changes`.
func (uc *WalletsUseCase) Update(ctx context.Context, id, userID uuid.UUID, changes domain.Wallet) error {
	current, err := uc.repo.ReadWallet(ctx, id)
	if err != nil {
		return err
	}
	if current.UserID != userID {
		return domain.ErrForbidden
	}

	// Aplicar solo los campos que el caller quiso cambiar
	if changes.Name != "" {
		current.Name = changes.Name
	}
	if changes.APIKey != nil {
		current.APIKey = changes.APIKey
	}
	if changes.APISecret != nil {
		current.APISecret = changes.APISecret
	}

	return uc.repo.UpdateWallet(ctx, id, current)
}

// SyncFromExchange obtiene los holdings del exchange asociado a la wallet
// y los upsertea como assets. Si la wallet no tiene API key o no hay exchange
// registrado para su plataforma, devuelve error.
func (uc *WalletsUseCase) SyncFromExchange(ctx context.Context, id, userID uuid.UUID) error {
	wallet, err := uc.repo.ReadWallet(ctx, id)
	if err != nil {
		return err
	}
	if wallet.UserID != userID {
		return domain.ErrForbidden
	}
	if wallet.APIKey == nil || wallet.APISecret == nil {
		return domain.ErrNoAPICredentials
	}

	platform, err := uc.platformRepo.GetByID(wallet.PlatformID.String())
	if err != nil {
		return fmt.Errorf("plataforma no encontrada: %w", err)
	}

	svc, ok := uc.exchanges[strings.ToLower(platform.Name)]
	if !ok {
		return domain.ErrExchangeNotSupported
	}

	holdings, err := svc.GetHoldings(*wallet.APIKey, *wallet.APISecret)
	if err != nil {
		return fmt.Errorf("exchange: %w", err)
	}

	for _, h := range holdings {
		existing, err := uc.assetsRepo.GetByWalletAndTicker(ctx, id, h.Ticker)
		if err != nil && !errors.Is(err, domain.ErrNotFound) {
			return err
		}
		if errors.Is(err, domain.ErrNotFound) || existing.ID == uuid.Nil {
			if _, err := uc.assetsRepo.Add(ctx, id, h.Ticker, h.Quantity); err != nil {
				return err
			}
		} else {
			if err := uc.assetsRepo.UpdateQuantity(ctx, id, h.Ticker, h.Quantity); err != nil {
				return err
			}
		}
	}

	return uc.repo.UpdateLastSync(ctx, id, time.Now())
}

// Delete elimina la wallet solo si pertenece al usuario.
func (uc *WalletsUseCase) Delete(ctx context.Context, id, userID uuid.UUID) error {
	wallet, err := uc.repo.ReadWallet(ctx, id)
	if err != nil {
		return err
	}
	if wallet.UserID != userID {
		return domain.ErrForbidden
	}
	return uc.repo.DeleteWallet(ctx, id)
}

// ─── ASSETS DENTRO DE UNA WALLET ─────────────────────────────────────────────

// ensureOwner valida que la wallet exista y pertenezca al usuario.
func (uc *WalletsUseCase) ensureOwner(ctx context.Context, walletID, userID uuid.UUID) error {
	w, err := uc.repo.ReadWallet(ctx, walletID)
	if err != nil {
		return err
	}
	if w.UserID != userID {
		return domain.ErrForbidden
	}
	return nil
}

// AddAsset agrega una tenencia. Si el ticker ya existe en la wallet, suma la cantidad.
func (uc *WalletsUseCase) AddAsset(
	ctx context.Context,
	walletID, userID uuid.UUID,
	ticker string,
	quantity float64,
) (domain.AssetWallet, error) {
	if ticker == "" {
		return domain.AssetWallet{}, ErrInvalidTicker
	}
	if quantity <= 0 {
		return domain.AssetWallet{}, ErrInvalidQuantity
	}
	if err := uc.ensureOwner(ctx, walletID, userID); err != nil {
		return domain.AssetWallet{}, err
	}
	return uc.assetsRepo.Add(ctx, walletID, ticker, quantity)
}

// ListAssets devuelve las tenencias crudas de la wallet.
func (uc *WalletsUseCase) ListAssets(
	ctx context.Context,
	walletID, userID uuid.UUID,
) ([]domain.AssetWallet, error) {
	if err := uc.ensureOwner(ctx, walletID, userID); err != nil {
		return nil, err
	}
	return uc.assetsRepo.ListByWallet(ctx, walletID)
}

// UpdateAssetQuantity reemplaza (no suma) la cantidad de un ticker.
func (uc *WalletsUseCase) UpdateAssetQuantity(
	ctx context.Context,
	walletID, userID uuid.UUID,
	ticker string,
	quantity float64,
) error {
	if ticker == "" {
		return ErrInvalidTicker
	}
	if quantity < 0 {
		return ErrInvalidQuantity
	}
	if err := uc.ensureOwner(ctx, walletID, userID); err != nil {
		return err
	}
	return uc.assetsRepo.UpdateQuantity(ctx, walletID, ticker, quantity)
}

// RemoveAsset elimina un ticker de la wallet.
func (uc *WalletsUseCase) RemoveAsset(
	ctx context.Context,
	walletID, userID uuid.UUID,
	ticker string,
) error {
	if ticker == "" {
		return ErrInvalidTicker
	}
	if err := uc.ensureOwner(ctx, walletID, userID); err != nil {
		return err
	}
	return uc.assetsRepo.Remove(ctx, walletID, ticker)
}

// GetWalletDetails devuelve la wallet con cada asset valuado al precio actual
// y el total de la wallet. Si el market service falla para un ticker, el asset
// se devuelve igualmente pero con Price=0 (no tira todo el endpoint).
func (uc *WalletsUseCase) GetWalletDetails(
	ctx context.Context,
	walletID, userID uuid.UUID,
) (domain.WalletDetails, error) {
	wallet, err := uc.repo.ReadWallet(ctx, walletID)
	if err != nil {
		return domain.WalletDetails{}, err
	}
	if wallet.UserID != userID {
		return domain.WalletDetails{}, domain.ErrForbidden
	}

	assets, err := uc.assetsRepo.ListByWallet(ctx, walletID)
	if err != nil {
		return domain.WalletDetails{}, err
	}

	views := make([]domain.WalletAssetView, 0, len(assets))
	var total float64
	var currency string

	for _, a := range assets {
		view := domain.WalletAssetView{
			Ticker:   a.Ticker,
			Quantity: a.Quantity,
		}
		if uc.market != nil {
			// "1d" es el rango mínimo soportado por el proveedor Yahoo
			if details, derr := uc.market.GetAssetDetails(a.Ticker, "1d"); derr == nil && details != nil {
				view.Name = details.Name
				view.Price = details.Price
				view.Currency = details.Currency
				view.MarketValue = a.Quantity * details.Price
				if currency == "" {
					currency = details.Currency
				}
			}
		}
		total += view.MarketValue
		views = append(views, view)
	}

	return domain.WalletDetails{
		Wallet:     wallet,
		Assets:     views,
		TotalValue: total,
		Currency:   currency,
	}, nil
}
