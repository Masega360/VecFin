package usecase

import (
	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type NotificationSettingUseCase struct {
	repo domain.NotificationSettingsRepository
}

func NewNotificationSettingUsecase(repo domain.NotificationSettingsRepository) *NotificationSettingUseCase {
	return &NotificationSettingUseCase{
		repo: repo,
	}
}

func (uc *NotificationSettingUseCase) GetSettings(userID uuid.UUID) (domain.NotificationSetting, error) {
	settings, err := uc.repo.GetByUserID(userID)
	if err != nil {
		// Si el usuario es nuevo y no tiene settings, podemos devolver uno por defecto
		if err.Error() == "not found" { // Ajusta esto según el error real de tu DB
			return domain.NotificationSetting{
				UserID:            userID,
				PriceAlerts:       true,
				CommunityActivity: true,
				NewMembers:        false,
				Marketing:         false,
				EnabledChannels:   []domain.ChannelPreference{domain.ChannelEmail, domain.ChannelInApp},
			}, nil
		}
		return domain.NotificationSetting{}, err
	}
	return settings, nil
}

func (uc *NotificationSettingUseCase) UpdateSettings(userID uuid.UUID, input domain.NotificationSetting) error {
	input.UserID = userID

	err := uc.repo.Update(input)
	if err != nil {
		return uc.repo.Create(input)
	}

	return nil
}
