package repository

import (
	"context"
	"database/sql"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostgresChatRepository struct {
	db *sql.DB
}

func NewPostgresChatRepository(db *sql.DB) *PostgresChatRepository {
	return &PostgresChatRepository{db: db}
}

func (r *PostgresChatRepository) CreateSession(ctx context.Context, userID uuid.UUID, title string) (domain.ChatSession, error) {
	var s domain.ChatSession
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO chat_sessions (user_id, title) VALUES ($1, $2)
		 RETURNING id, user_id, title, created_at`,
		userID, title,
	).Scan(&s.ID, &s.UserID, &s.Title, &s.CreatedAt)
	return s, err
}

func (r *PostgresChatRepository) ListSessions(ctx context.Context, userID uuid.UUID) ([]domain.ChatSession, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, title, created_at FROM chat_sessions
		 WHERE user_id = $1 ORDER BY created_at DESC`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var sessions []domain.ChatSession
	for rows.Next() {
		var s domain.ChatSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.Title, &s.CreatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

func (r *PostgresChatRepository) GetSession(ctx context.Context, id uuid.UUID) (domain.ChatSession, error) {
	var s domain.ChatSession
	err := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, title, created_at FROM chat_sessions WHERE id = $1`, id,
	).Scan(&s.ID, &s.UserID, &s.Title, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return s, domain.ErrNotFound
	}
	return s, err
}

func (r *PostgresChatRepository) AddMessage(ctx context.Context, sessionID uuid.UUID, role, content string) (domain.ChatMessage, error) {
	var m domain.ChatMessage
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)
		 RETURNING id, session_id, role, content, created_at`,
		sessionID, role, content,
	).Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.CreatedAt)
	return m, err
}

func (r *PostgresChatRepository) ListMessages(ctx context.Context, sessionID uuid.UUID) ([]domain.ChatMessage, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, session_id, role, content, created_at FROM chat_messages
		 WHERE session_id = $1 ORDER BY created_at ASC`, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var msgs []domain.ChatMessage
	for rows.Next() {
		var m domain.ChatMessage
		if err := rows.Scan(&m.ID, &m.SessionID, &m.Role, &m.Content, &m.CreatedAt); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}


func (r *PostgresChatRepository) DeleteSession(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM chat_sessions WHERE id = $1`, id)
	return err
}

func (r *PostgresChatRepository) RenameSession(ctx context.Context, id uuid.UUID, title string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE chat_sessions SET title = $1 WHERE id = $2`, title, id)
	return err
}
