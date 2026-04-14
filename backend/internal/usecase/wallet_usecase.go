package usecase

import (
	"context"
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

type WalletsUseCase struct {
	repo walletRepository
}

func NewWalletsUseCase(repo walletRepository) *WalletsUseCase {
	return &WalletsUseCase{repo: repo}
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

// UpdateLastSync marca la wallet como sincronizada ahora.
// Se llama cuando la API de la plataforma devuelve datos nuevos.
func (uc *WalletsUseCase) UpdateLastSync(ctx context.Context, id, userID uuid.UUID) error {
	wallet, err := uc.repo.ReadWallet(ctx, id)
	if err != nil {
		return err
	}
	if wallet.UserID != userID {
		return domain.ErrForbidden
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
