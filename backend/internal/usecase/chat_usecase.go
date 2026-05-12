package usecase

import (
	"context"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type chatRepository interface {
	CreateSession(ctx context.Context, userID uuid.UUID, title string) (domain.ChatSession, error)
	ListSessions(ctx context.Context, userID uuid.UUID) ([]domain.ChatSession, error)
	GetSession(ctx context.Context, id uuid.UUID) (domain.ChatSession, error)
	AddMessage(ctx context.Context, sessionID uuid.UUID, role, content string) (domain.ChatMessage, error)
	ListMessages(ctx context.Context, sessionID uuid.UUID) ([]domain.ChatMessage, error)
}

type ChatUsecase struct {
	repo chatRepository
	ai   domain.AIProvider
}

func NewChatUsecase(repo chatRepository, ai domain.AIProvider) *ChatUsecase {
	return &ChatUsecase{repo: repo, ai: ai}
}

func (uc *ChatUsecase) CreateSession(ctx context.Context, userID uuid.UUID, title string) (domain.ChatSession, error) {
	if title == "" {
		title = "Nueva conversación"
	}
	return uc.repo.CreateSession(ctx, userID, title)
}

func (uc *ChatUsecase) ListSessions(ctx context.Context, userID uuid.UUID) ([]domain.ChatSession, error) {
	return uc.repo.ListSessions(ctx, userID)
}

func (uc *ChatUsecase) ListMessages(ctx context.Context, sessionID, userID uuid.UUID) ([]domain.ChatMessage, error) {
	session, err := uc.repo.GetSession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	if session.UserID != userID {
		return nil, domain.ErrForbidden
	}
	return uc.repo.ListMessages(ctx, sessionID)
}

// SendMessage guarda el mensaje del usuario, llama a la IA con el historial y guarda la respuesta.
func (uc *ChatUsecase) SendMessage(ctx context.Context, sessionID, userID uuid.UUID, content string) (domain.ChatMessage, error) {
	session, err := uc.repo.GetSession(ctx, sessionID)
	if err != nil {
		return domain.ChatMessage{}, err
	}
	if session.UserID != userID {
		return domain.ChatMessage{}, domain.ErrForbidden
	}

	history, err := uc.repo.ListMessages(ctx, sessionID)
	if err != nil {
		return domain.ChatMessage{}, err
	}

	if _, err := uc.repo.AddMessage(ctx, sessionID, "user", content); err != nil {
		return domain.ChatMessage{}, err
	}

	reply, err := uc.ai.SendMessage(ctx, history, content)
	if err != nil {
		return domain.ChatMessage{}, err
	}

	return uc.repo.AddMessage(ctx, sessionID, "model", reply)
}
