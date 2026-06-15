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
			EnabledChannels:   []domain.ChannelPreference{domain.ChannelEmail, domain.ChannelInApp},
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

	title := fmt.Sprintf("VecFin - Alerta de %s", alert.Symbol)

	message := fmt.Sprintf(
		"¡Tenemos novedades sobre tus activos!\n\n"+
			"El activo %s ha alcanzado tu precio objetivo.\n\n"+
			"Precio Objetivo: $%.2f\n"+
			"Precio Actual: $%.2f\n\n"+
			"Ingresa a tu cuenta para gestionar tu portafolio.",
		alert.Symbol, alert.TargetPrice, currentPrice,
	)

	d.dispatchToChannels(alert.UserID, settings.EnabledChannels, title, message)
	return nil
}

func (d *NotificationDispatcher) DispatchFollowRequest(targetUserID uuid.UUID, followerName string) {
	go func() {
		settings := d.getSettingsOrDefault(targetUserID)
		if !settings.FollowRequests {
			return
		}

		title := "Nueva solicitud de seguimiento en VecFin"
		message := fmt.Sprintf(
			"¡Tienes una nueva solicitud de seguimiento!\n\n"+
				"El usuario %s ha solicitado seguirte.\n\n"+
				"Ingresa a la aplicación para aceptar o rechazar esta solicitud en tu panel de notificaciones.",
			followerName,
		)

		d.dispatchToChannels(targetUserID, settings.EnabledChannels, title, message)
	}()
}

func (d *NotificationDispatcher) DispatchNewMemberRequest(adminIDs []uuid.UUID, communityName, applicantName string) {
	go func() {
		title := fmt.Sprintf("Nueva solicitud en %s", communityName)
		message := fmt.Sprintf(
			"¡Hola! Tienes nuevas tareas de moderación.\n\n"+
				"El usuario %s ha solicitado unirse a la comunidad privada %s.\n\n"+
				"Ingresa a tu panel de administración en VecFin para aceptar o rechazar esta solicitud.",
			applicantName, communityName,
		)

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
		if approved {
			estadoStr = "aprobada"
		}

		title := fmt.Sprintf("Actualización de tu solicitud en %s", communityName)
		message := fmt.Sprintf(
			"¡Hola! Tenemos novedades sobre tu solicitud.\n\n"+
				"Tu solicitud para unirte a la comunidad %s ha sido %s.",
			communityName, estadoStr,
		)

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
		message := fmt.Sprintf(
			"Aviso importante sobre tu cuenta.\n\n"+
				"Has sido removido de la comunidad %s por un administrador o moderador.",
			communityName,
		)

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
		message := fmt.Sprintf(
			"¡Felicitaciones! Tus permisos han sido actualizados.\n\n"+
				"Has sido designado como %s en la comunidad %s.\n\n"+
				"Ingresa a VecFin para gestionar la comunidad.",
			rolTexto, communityName,
		)

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
			targetStr = fmt.Sprintf("tu post \"%s\"", postTitle)
		}

		title := "Nueva respuesta en tu post"
		message := fmt.Sprintf(
			"¡Alguien está interactuando contigo!\n\n"+
				"El usuario %s ha dejado un comentario en %s.\n\n"+
				"Ingresa a VecFin para continuar la conversación.",
			replierName, targetStr,
		)

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
			targetStr = fmt.Sprintf("tu post \"%s\"", postTitle)
		}

		accion := "downvote"
		if isUpvote {
			accion = "upvote"
		}

		title := "Nueva reacción a tu post"
		message := fmt.Sprintf(
			"¡Tu contenido está generando reacciones!\n\n"+
				"Alguien le ha dado %s a %s.",
			accion, targetStr,
		)

		d.dispatchToChannels(authorID, settings.EnabledChannels, title, message)
	}()
}
