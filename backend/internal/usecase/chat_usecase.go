package usecase

import (
	"context"
	"fmt"
	"strings"

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

type chatUserRepository interface {
	FindByID(id uuid.UUID) (domain.User, error)
}

type chatWalletRepository interface {
	ListByUser(ctx context.Context, userID uuid.UUID) ([]domain.Wallet, error)
}

type chatAssetWalletRepository interface {
	ListByWallet(ctx context.Context, walletID uuid.UUID) ([]domain.AssetWallet, error)
}

type chatMarketService interface {
	GetAssetDetails(symbol, rangeParam string) (*domain.AssetDetails, error)
}

type chatNewsProvider interface {
	HotTopics() []string
	HeadlinesByQuery(query string) []domain.News
}

type ChatUsecase struct {
	repo        chatRepository
	ai          domain.AIProvider
	users       chatUserRepository
	wallets     chatWalletRepository
	assetWallet chatAssetWalletRepository
	market      chatMarketService
	news        chatNewsProvider
}

func NewChatUsecase(repo chatRepository, ai domain.AIProvider, users chatUserRepository, wallets chatWalletRepository, assetWallet chatAssetWalletRepository, market chatMarketService, news chatNewsProvider) *ChatUsecase {
	return &ChatUsecase{repo: repo, ai: ai, users: users, wallets: wallets, assetWallet: assetWallet, market: market, news: news}
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

	sysCtx := uc.buildUserContext(ctx, userID)

	reply, err := uc.ai.SendMessage(ctx, history, content, sysCtx)
	if err != nil {
		return domain.ChatMessage{}, err
	}

	msg, err := uc.repo.AddMessage(ctx, sessionID, "model", reply.Content)
	if err != nil {
		return domain.ChatMessage{}, err
	}
	msg.Provider = reply.Provider
	return msg, nil
}

func (uc *ChatUsecase) buildUserContext(ctx context.Context, userID uuid.UUID) string {
	user, err := uc.users.FindByID(userID)
	if err != nil {
		return ""
	}

	var sb strings.Builder
	fmt.Fprintf(&sb, "Usuario: %s %s | Perfil de riesgo: %s\n", user.FirstName, user.LastName, user.RiskType)

	wallets, err := uc.wallets.ListByUser(ctx, userID)
	if err != nil || len(wallets) == 0 {
		return sb.String()
	}

	var totalUSD float64
	var tickers []string
	sb.WriteString("Wallets y activos:\n")
	for _, w := range wallets {
		assets, err := uc.assetWallet.ListByWallet(ctx, w.ID)
		if err != nil || len(assets) == 0 {
			continue
		}
		fmt.Fprintf(&sb, "- %s: ", w.Name)
		items := make([]string, 0, len(assets))
		for _, a := range assets {
			tickers = append(tickers, a.Ticker)
			if uc.market != nil {
				if details, derr := uc.market.GetAssetDetails(a.Ticker, "1d"); derr == nil && details != nil {
					val := a.Quantity * details.Price
					totalUSD += val
					items = append(items, fmt.Sprintf("%s: %.4f unidades × $%.2f = $%.2f %s", a.Ticker, a.Quantity, details.Price, val, details.Currency))
					continue
				}
			}
			items = append(items, fmt.Sprintf("%s: %.4f unidades (precio no disponible)", a.Ticker, a.Quantity))
		}
		sb.WriteString(strings.Join(items, ", "))
		sb.WriteString("\n")
	}
	if totalUSD > 0 {
		fmt.Fprintf(&sb, "Valor total estimado: $%.2f USD\n", totalUSD)
	}

	// Noticias específicas de los activos del usuario
	sb.WriteString("\nNoticias recientes relevantes (citá título y URL cuando recomiendes):\n")
	seen := map[string]bool{}
	for _, ticker := range tickers {
		news := uc.news.HeadlinesByQuery(ticker)
		for _, n := range news {
			if seen[n.Title] {
				continue
			}
			seen[n.Title] = true
			fmt.Fprintf(&sb, "- %s | Fuente: %s | URL: %s\n", n.Title, n.Source, n.URL)
		}
	}
	if len(seen) == 0 {
		if topics := uc.news.HotTopics(); len(topics) > 0 {
			for _, t := range topics {
				sb.WriteString("- " + t + "\n")
			}
		}
	}
	return sb.String()
}
