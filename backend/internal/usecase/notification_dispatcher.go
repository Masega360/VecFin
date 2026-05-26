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
	// Armamos el "relleno" específico para la alerta de precios
	// Fíjate que armamos una pequeña tarjeta gris para resaltar los precios
	message := fmt.Sprintf(`
        <p style="font-size: 16px;">¡Tenemos novedades sobre tus activos!</p>
        <p style="font-size: 16px;">El activo <strong style="color: #00ADD8; font-size: 18px;">%s</strong> ha alcanzado tu precio objetivo.</p>
        
        <table width="100%%" cellpadding="0" cellspacing="0" style="margin: 24px 0; background-color: #f4f7f6; border-radius: 8px; border-left: 4px solid #00ADD8;">
            <tr>
                <td style="padding: 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a6a80;">Precio Objetivo</p>
                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #132238;">$%.2f</p>
                </td>
                <td style="padding: 16px;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #4a6a80;">Precio Actual</p>
                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #00D26A;">$%.2f</p>
                </td>
            </tr>
        </table>
        
        <p style="font-size: 16px;">Ingresa a tu cuenta para gestionar tu portafolio y revisar tus próximas jugadas.</p>
    `, alert.Symbol, alert.TargetPrice, currentPrice)

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
