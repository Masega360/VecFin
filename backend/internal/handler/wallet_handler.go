package handler

import (
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type WalletUsecasePort interface {
	CreateWallet(wallet domain.Wallet) error
	ReadWallets(query string) ([]domain.Wallet, error)
	UpdateWallet(id uuid.UUID, wallet domain.Wallet) error
	DeleteWallet(id uuid.UUID) error
	GetWalletDetails(id string) (*domain.Wallet, error)
	ConnectWalletAPI() //TODO
	AddAsset(asset domain.Asset) error
	GetWalletAssets(id string) ([]domain.Asset, error)
}

type WalletHandler struct {
	uc WalletUsecasePort
}

func NewWalletHandler(uc WalletUsecasePort) *WalletHandler {}

func (h *WalletHandler) Create(w http.ResponseWriter, r *http.Request) {

}
func (h *WalletHandler) Search(w http.ResponseWriter, r *http.Request)           {}
func (h *WalletHandler) Update(w http.ResponseWriter, r *http.Request)           {}
func (h *WalletHandler) Delete(w http.ResponseWriter, r *http.Request)           {}
func (h *WalletHandler) AddAsset(asset domain.Asset) error                       {}
func (h *WalletHandler) GetAssets(w http.ResponseWriter, r *http.Request)        {}
func (h *WalletHandler) GetWalletDetails(w http.ResponseWriter, r *http.Request) {}
