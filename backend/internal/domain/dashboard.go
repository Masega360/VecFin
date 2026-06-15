package domain

import "github.com/google/uuid"

// Le cambiamos el nombre conceptualmente a ProfileSummary o dejamos DashboardData
type DashboardData struct {
	UserID uuid.UUID `json:"user_id"`

	// Social Info
	FollowersCount int          `json:"followers_count"`
	FollowingCount int          `json:"following_count"`
	FollowStatus   FollowStatus `json:"follow_status"` // pending, approved, canceled

	// Portfolio Summary
	TotalValue   float64 `json:"total_value"`
	TotalCost    float64 `json:"total_cost"`
	TotalGain    float64 `json:"total_gain"`
	TotalGainPct float64 `json:"total_gain_pct"`
	DayChange    float64 `json:"day_change"`
	DayChangePct float64 `json:"day_change_pct"`

	// Distribution
	Holdings       []HoldingInfo  `json:"holdings"`
	TopPerformer   *PerformerInfo `json:"top_performer,omitempty"`
	WorstPerformer *PerformerInfo `json:"worst_performer,omitempty"`

	// Counts
	TotalWallets   int `json:"total_wallets"`
	TotalAssets    int `json:"total_assets"`
	CommunityCount int `json:"community_count"`
	PostCount      int `json:"post_count"`
}

type HoldingInfo struct {
	Symbol     string  `json:"symbol"`
	Name       string  `json:"name"`
	Value      float64 `json:"value"`
	Percentage float64 `json:"percentage"`
	ChangePct  float64 `json:"change_pct"`
}

type PerformerInfo struct {
	Symbol    string  `json:"symbol"`
	Name      string  `json:"name"`
	ChangePct float64 `json:"change_pct"`
}
