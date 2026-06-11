package usecase

import (
	"fmt"
	"log"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/infrastructure"
	"github.com/google/uuid"
)

type NotificationDispatcher struct {
	settingsRepo domain.NotificationSettingsRepository
	providers    map[domain.ChannelPreference]infrastructure.NotificationProvider
}

func NewNotificationDispatcher(sRepo domain.NotificationSettingsRepository) *NotificationDispatcher {
	return &NotificationDispatcher{
		settingsRepo: sRepo,
		providers:    make(map[domain.ChannelPreference]infrastructure.NotificationProvider),
	}
}

func (d *NotificationDispatcher) RegisterProvider(channel domain.ChannelPreference, provider infrastructure.NotificationProvider) {
	d.providers[channel] = provider
}

func (d *NotificationDispatcher) getSettingsOrDefault(userID uuid.UUID) domain.NotificationSetting {
	settings, err := d.settingsRepo.GetByUserID(userID)
	if err != nil {
		return domain.NotificationSetting{
			UserID:            userID,
			PriceAlerts:       true,
			CommunityActivity: true,
			NewMembers:        true,
			FollowRequests:    true,
			EnabledChannels:   []domain.ChannelPreference{domain.ChannelEmail},
		}
	}
	return settings
}

func (d *NotificationDispatcher) dispatchToChannels(userID uuid.UUID, channels []domain.ChannelPreference, title, message string) {
	for _, channel := range channels {
		if provider, exists := d.providers[channel]; exists {
			err := provider.Send(userID, title, message)
			if err != nil {
				log.Printf("[Dispatcher] Error enviando a %s por canal %s: %v\n", userID, channel, err)
			}
		}
	}
}

func (d *NotificationDispatcher) DispatchPriceAlert(alert domain.PriceAlert, currentPrice float64) error {
	settings := d.getSettingsOrDefault(alert.UserID)
	if !settings.PriceAlerts {
		return nil
	}

	title := fmt.Sprintf("vecFin - Alerta de %s", alert.Symbol)
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

	d.dispatchToChannels(alert.UserID, settings.EnabledChannels, title, message)
	return nil
}

func (d *NotificationDispatcher) DispatchFollowRequest(targetUserID uuid.UUID, followerName string) {
	go func() {
		settings := d.getSettingsOrDefault(targetUserID)
		if !settings.FollowRequests {
			return
		}

		title := "Nueva solicitud de seguimiento en vecFin"
		message := fmt.Sprintf(`
           <p style="font-size: 16px;">¡Tienes una nueva solicitud de seguimiento!</p>
           <p style="font-size: 16px;">El usuario <strong style="color: #00ADD8; font-size: 18px;">%s</strong> ha solicitado seguirte</p>
           <p style="font-size: 16px;">Ingresa a la aplicación para aceptar o rechazar esta solicitud en tu panel de notificaciones.</p>
       `, followerName)

		d.dispatchToChannels(targetUserID, settings.EnabledChannels, title, message)
	}()
}

func (d *NotificationDispatcher) DispatchNewMemberRequest(adminIDs []uuid.UUID, communityName, applicantName string) {
	go func() {
		title := fmt.Sprintf("Nueva solicitud en %s", communityName)
		message := fmt.Sprintf(`
           <p style="font-size: 16px;">¡Hola! Tienes nuevas tareas de moderación.</p>
           <p style="font-size: 16px;">El usuario <strong style="color: #00ADD8; font-size: 18px;">%s</strong> ha solicitado unirse a la comunidad privada <strong style="color: #132238;">%s</strong>.</p>
           <p style="font-size: 16px;">Ingresa a tu panel de administración en vecFin para aceptar o rechazar esta solicitud.</p>
       `, applicantName, communityName)

		for _, adminID := range adminIDs {
			settings := d.getSettingsOrDefault(adminID)
			if !settings.NewMembers {
				continue
			}
			d.dispatchToChannels(adminID, settings.EnabledChannels, title, message)
		}
	}()
}

func (d *NotificationDispatcher) DispatchJoinRequestResolved(applicantID uuid.UUID, communityName string, approved bool) {
	go func() {
		settings := d.getSettingsOrDefault(applicantID)
		if !settings.CommunityActivity {
			return
		}

		estadoStr := "rechazada"
		color := "#ff4d4f"
		if approved {
			estadoStr = "aprobada"
			color = "#00D26A"
		}

		title := fmt.Sprintf("Actualización de tu solicitud en %s", communityName)
		message := fmt.Sprintf(`
           <p style="font-size: 16px;">¡Hola! Tenemos novedades sobre tu solicitud.</p>
           <p style="font-size: 16px;">Tu solicitud para unirte a la comunidad <strong style="color: #132238;">%s</strong> ha sido <strong style="color: %s;">%s</strong>.</p>
       `, communityName, color, estadoStr)

		d.dispatchToChannels(applicantID, settings.EnabledChannels, title, message)
	}()
}

func (d *NotificationDispatcher) DispatchMemberKicked(targetID uuid.UUID, communityName string) {
	go func() {
		settings := d.getSettingsOrDefault(targetID)
		if !settings.CommunityActivity {
			return
		}

		title := fmt.Sprintf("Novedades de la comunidad %s", communityName)
		message := fmt.Sprintf(`
           <p style="font-size: 16px;">Aviso importante sobre tu cuenta.</p>
           <p style="font-size: 16px;">Has sido removido de la comunidad <strong style="color: #132238;">%s</strong> por un administrador o moderador.</p>
       `, communityName)

		d.dispatchToChannels(targetID, settings.EnabledChannels, title, message)
	}()
}

func (d *NotificationDispatcher) DispatchRoleChanged(targetID uuid.UUID, communityName, newRole string) {
	go func() {
		settings := d.getSettingsOrDefault(targetID)
		if !settings.CommunityActivity {
			return
		}

		rolTexto := "Líder (Owner)"
		if newRole == string(domain.RoleModerator) {
			rolTexto = "Moderador"
		}

		title := fmt.Sprintf("Nuevos permisos en %s", communityName)
		message := fmt.Sprintf(`
           <p style="font-size: 16px;">¡Felicitaciones! Tus permisos han sido actualizados.</p>
           <p style="font-size: 16px;">Has sido designado como <strong style="color: #00ADD8;">%s</strong> en la comunidad <strong style="color: #132238;">%s</strong>.</p>
           <p style="font-size: 16px;">Ingresa a vecFin para gestionar la comunidad.</p>
       `, rolTexto, communityName)

		d.dispatchToChannels(targetID, settings.EnabledChannels, title, message)
	}()
}

func (d *NotificationDispatcher) DispatchPostReply(authorID uuid.UUID, postTitle, replierName string) {
	go func() {
		settings := d.getSettingsOrDefault(authorID)
		if !settings.CommunityActivity {
			return
		}

		targetStr := "tu publicación"
		if postTitle != "" {
			targetStr = fmt.Sprintf("tu post <strong style=\"color: #132238;\">\"%s\"</strong>", postTitle)
		}

		title := "Nueva respuesta en tu post"
		message := fmt.Sprintf(`
           <p style="font-size: 16px;">¡Alguien está interactuando contigo!</p>
           <p style="font-size: 16px;">El usuario <strong style="color: #00ADD8;">%s</strong> ha dejado un comentario en %s.</p>
           <p style="font-size: 16px;">Ingresa a VecFin para continuar la conversación.</p>
       `, replierName, targetStr)

		d.dispatchToChannels(authorID, settings.EnabledChannels, title, message)
	}()
}

func (d *NotificationDispatcher) DispatchPostVote(authorID uuid.UUID, postTitle string, isUpvote bool) {
	go func() {
		settings := d.getSettingsOrDefault(authorID)
		if !settings.CommunityActivity {
			return
		}

		targetStr := "tu publicación"
		if postTitle != "" {
			targetStr = fmt.Sprintf("tu post <strong style=\"color: #132238;\">\"%s\"</strong>", postTitle)
		}

		accion := "downvote"
		color := "#ff4d4f"

		if isUpvote {
			accion = "upvote"
			color = "#00D26A"
		}

		title := "Nueva reacción a tu post"
		message := fmt.Sprintf(`
           <p style="font-size: 16px;">¡Tu contenido está generando reacciones!</p>
           <p style="font-size: 16px;">Alguien le ha dado <strong style="color: %s;">%s</strong> a %s.</p>
       `, color, accion, targetStr)

		d.dispatchToChannels(authorID, settings.EnabledChannels, title, message)
	}()
}
