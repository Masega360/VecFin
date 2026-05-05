package repository

import (
	"database/sql"
	"errors"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type PostgresNotificationSettingsRepository struct {
	db *sql.DB
}

func NewPostgresNotificationSettingsRepository(db *sql.DB) *PostgresNotificationSettingsRepository {
	return &PostgresNotificationSettingsRepository{db: db}
}

func (r *PostgresNotificationSettingsRepository) Create(setting domain.NotificationSetting) error {
	// Convertimos el tipo custom a []string nativo para lib/pq
	var strChannels []string
	for _, ch := range setting.EnabledChannels {
		strChannels = append(strChannels, string(ch))
	}

	query := `
       INSERT INTO notification_settings 
       (user_id, price_alerts, community_activity, new_members, marketing, enabled_channels)
       VALUES ($1, $2, $3, $4, $5, $6)
    `
	_, err := r.db.Exec(query,
		setting.UserID,
		setting.PriceAlerts,
		setting.CommunityActivity,
		setting.NewMembers,
		setting.Marketing,
		pq.Array(strChannels),
	)
	return err
}

func (r *PostgresNotificationSettingsRepository) GetByUserID(userID uuid.UUID) (domain.NotificationSetting, error) {
	var setting domain.NotificationSetting
	var strChannels []string // Leemos la DB en un []string nativo

	query := `
       SELECT user_id, price_alerts, community_activity, new_members, marketing, enabled_channels
       FROM notification_settings 
       WHERE user_id = $1
    `
	err := r.db.QueryRow(query, userID).Scan(
		&setting.UserID,
		&setting.PriceAlerts,
		&setting.CommunityActivity,
		&setting.NewMembers,
		&setting.Marketing,
		pq.Array(&strChannels), // Escaneamos el TEXT[] hacia el []string
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// El UseCase espera que digamos "not found" si no existe
			return domain.NotificationSetting{}, errors.New("not found")
		}
		return domain.NotificationSetting{}, err
	}

	for _, ch := range strChannels {
		setting.EnabledChannels = append(setting.EnabledChannels, domain.ChannelPreference(ch))
	}

	return setting, nil
}

func (r *PostgresNotificationSettingsRepository) Update(setting domain.NotificationSetting) error {
	var strChannels []string
	for _, ch := range setting.EnabledChannels {
		strChannels = append(strChannels, string(ch))
	}

	// El updated_at se actualiza solo gracias al Trigger de Postgres
	query := `
       UPDATE notification_settings
       SET price_alerts = $1, 
           community_activity = $2, 
           new_members = $3, 
           marketing = $4, 
           enabled_channels = $5
       WHERE user_id = $6
    `
	res, err := r.db.Exec(query,
		setting.PriceAlerts,
		setting.CommunityActivity,
		setting.NewMembers,
		setting.Marketing,
		pq.Array(strChannels),
		setting.UserID,
	)
	if err != nil {
		return err
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("not found") // Dispara el "Create" en el UseCase
	}

	return nil
}

func (r *PostgresNotificationSettingsRepository) Delete(userID uuid.UUID) error {
	query := `DELETE FROM notification_settings WHERE user_id = $1`
	_, err := r.db.Exec(query, userID)
	return err
}
