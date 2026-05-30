package domain

type DashboardData struct {
	// Portfolio summary
	TotalValue    float64 `json:"total_value"`
	TotalCost     float64 `json:"total_cost"`
	TotalGain     float64 `json:"total_gain"`
	TotalGainPct  float64 `json:"total_gain_pct"`
	DayChange     float64 `json:"day_change"`
	DayChangePct  float64 `json:"day_change_pct"`

	// Distribution
	Holdings []HoldingInfo `json:"holdings"`

	// Performance
	TopPerformer   *PerformerInfo `json:"top_performer"`
	WorstPerformer *PerformerInfo `json:"worst_performer"`

	// Alerts
	ActiveAlerts int `json:"active_alerts"`

	// Counts
	TotalWallets int `json:"total_wallets"`
	TotalAssets  int `json:"total_assets"`
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
