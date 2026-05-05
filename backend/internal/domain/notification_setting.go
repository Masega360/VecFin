package domain

import (
	"github.com/google/uuid"
)

type ChannelPreference string

const (
	ChannelEmail ChannelPreference = "EMAIL"
	ChannelSMS   ChannelPreference = "SMS"
	ChannelInApp ChannelPreference = "IN_APP"
)

type NotificationSetting struct {
	UserID uuid.UUID `json:"user_id"`

	// Que quiere recibir
	PriceAlerts       bool `json:"price_alerts"`
	CommunityActivity bool `json:"community_activity"`
	NewMembers        bool `json:"new_members"`
	Marketing         bool `json:"marketing"` // alguna promocion extra o algo asi

	// Por donde lo quiere recibir
	EnabledChannels []ChannelPreference `json:"enabled_channels"`
}
type NotificationSettingsRepository interface {
	Create(setting NotificationSetting) error
	GetByUserID(userID uuid.UUID) (NotificationSetting, error)
	Update(setting NotificationSetting) error
	Delete(userID uuid.UUID) error
}
