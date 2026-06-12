package repository

import (
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresInAppNotificationRepository struct {
	db *sql.DB
}

func NewPostgresInAppNotificationRepository(db *sql.DB) *PostgresInAppNotificationRepository {
	return &PostgresInAppNotificationRepository{db: db}
}

func (r *PostgresInAppNotificationRepository) Create(notif domain.InAppNotification) error {
	query := `INSERT INTO in_app_notifications (id, user_id, title, message, is_read, created_at) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := r.db.Exec(query, notif.ID, notif.UserID, notif.Title, notif.Message, notif.IsRead, notif.CreatedAt)
	return err
}

func (r *PostgresInAppNotificationRepository) GetByUserID(userID uuid.UUID) ([]domain.InAppNotification, error) {
	query := `SELECT id, user_id, title, message, is_read, created_at FROM in_app_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notifs []domain.InAppNotification
	for rows.Next() {
		var n domain.InAppNotification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Title, &n.Message, &n.IsRead, &n.CreatedAt); err != nil {
			return nil, err
		}
		notifs = append(notifs, n)
	}
	return notifs, nil
}

func (r *PostgresInAppNotificationRepository) MarkAsRead(notifID, userID uuid.UUID) error {
	_, err := r.db.Exec(`UPDATE in_app_notifications SET is_read = true WHERE id = $1 AND user_id = $2`, notifID, userID)
	return err
}

func (r *PostgresInAppNotificationRepository) GetUnreadCount(userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM in_app_notifications WHERE user_id = $1 AND is_read = false`, userID).Scan(&count)
	return count, err
}
