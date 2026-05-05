package usecase

import (
	"github.com/Masega360/vecfin/backend/internal/domain"
)

type platformUsecase struct {
	repo domain.PlatformRepository
}

func NewPlatformUsecase(repo domain.PlatformRepository) *platformUsecase {
	return &platformUsecase{repo: repo}
}

func (u *platformUsecase) SearchPlatform(query string) ([]domain.Platform, error) {
	return u.repo.Search(query)
}

func (u *platformUsecase) GetPlatformDetails(id string) (*domain.Platform, error) {
	return u.repo.GetByID(id)
}
