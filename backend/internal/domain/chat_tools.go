package domain

// ChatToolExecutor executes tools requested by the AI during chat.
type ChatToolExecutor interface {
	SearchNews(query string) string
	GetAssetPrice(symbol string) string
	SearchAssets(query string) string
}
