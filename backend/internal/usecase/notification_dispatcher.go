package usecase

import (
	"fmt"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

type NotificationDispatcher struct {
	settingsRepo domain.NotificationSettingsRepository
	// Un mapa que relaciona cada canal (EMAIL, SMS) con su proveedor real
	providers map[domain.ChannelPreference]domain.NotificationProvider
}

func NewNotificationDispatcher(sRepo domain.NotificationSettingsRepository) *NotificationDispatcher {
	return &NotificationDispatcher{
		settingsRepo: sRepo,
		providers:    make(map[domain.ChannelPreference]domain.NotificationProvider),
	}
}

// Permite "conectar" nuevos canales al sistema fácilmente
func (d *NotificationDispatcher) RegisterProvider(channel domain.ChannelPreference, provider domain.NotificationProvider) {
	d.providers[channel] = provider
}

func (d *NotificationDispatcher) DispatchPriceAlert(alert domain.PriceAlert, currentPrice float64) error {
	// 1. Chequear si el usuario quiere alertas (Master Switch)
	settings, err := d.settingsRepo.GetByUserID(alert.UserID)
	if err != nil {
		if err.Error() != "not found" {
			return err
		}
		// Si no hay settings asumo que quiere email por defecto (o podés cortar acá)
		settings.EnabledChannels = []domain.ChannelPreference{domain.ChannelEmail}
		settings.PriceAlerts = true
	}

	if !settings.PriceAlerts {
		return nil // El Master Switch está apagado
	}

	// 2. Armar el mensaje base genérico (sirve para Mail, App y SMS)
	title := fmt.Sprintf("vecFin - Alerta de %s", alert.Symbol)
	message := fmt.Sprintf("El activo %s alcanzó tu precio objetivo de $%.2f. (Precio actual: $%.2f)",
		alert.Symbol, alert.TargetPrice, currentPrice)

	// 3. Iterar por los canales que el usuario activó
	for _, channel := range settings.EnabledChannels {
		// Buscar si tenemos un proveedor registrado para ese canal
		if provider, exists := d.providers[channel]; exists {
			err := provider.Send(alert.UserID, title, message)
			if err != nil {
				fmt.Printf("Error enviando por canal %s: %v\n", channel, err)
			}
		}
	}

	return nil
}
