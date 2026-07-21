package infrastructure

import (
	"fmt"
	"net/smtp"
	"strings"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type SMTPConfig struct {
	SMTPServer string
	Port       int
	Sender     string
	Password   string
}

type NotificationProvider interface {
	Send(userID uuid.UUID, title, message, link string) error
}

type EmailService struct {
	UserRepo domain.UserRepository
	Config   SMTPConfig
}

func NewEmailService(userRepo domain.UserRepository, config SMTPConfig) *EmailService {
	return &EmailService{
		UserRepo: userRepo,
		Config:   config,
	}
}

func (s *EmailService) Send(userID uuid.UUID, title, message, link string) error {
	user, err := s.UserRepo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("no se encontró el usuario para enviar mail: %w", err)
	}

	auth := smtp.PlainAuth("", s.Config.Sender, s.Config.Password, s.Config.SMTPServer)
	to := []string{user.Email}
	addr := fmt.Sprintf("%s:%d", s.Config.SMTPServer, s.Config.Port)

	headers := "MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=\"UTF-8\"\r\n" +
		"To: " + user.Email + "\r\n" +
		"Subject: " + title + "\r\n\r\n"

	// 🚀 FORMATEO: Convertimos los \n del texto plano en <br> para HTML
	htmlFormattedMessage := strings.ReplaceAll(message, "\n", "<br>")

	// URL de la app
	appURL := "https://rover-lately-closed-cubic.trycloudflare.com"
	buttonHTML := ""
	if link != "" {
		buttonHTML = fmt.Sprintf(`
			<a href="%s" style="display: inline-block; margin-top: 24px; padding: 14px 28px; background-color: #00ADD8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Ir a VecFin</a>
		`, appURL+link)
	} else {
		buttonHTML = fmt.Sprintf(`
			<a href="%s" style="display: inline-block; margin-top: 24px; padding: 14px 28px; background-color: #00ADD8; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Abrir VecFin</a>
		`, appURL)
	}

	// 2. El "Layout Maestro".
	htmlBody := fmt.Sprintf(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f7f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table width="100%%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f6; padding: 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                        
                        <tr>
                            <td style="background-color: #0a1628; padding: 24px; text-align: center;">
                                <h1 style="color: #00ADD8; margin: 0; font-size: 28px; letter-spacing: 1px;">VecFin</h1>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding: 32px; color: #132238; line-height: 1.6;">
                                <p style="font-size: 18px; margin-top: 0;">Hola <strong>%s</strong>,</p>
                                
                                <div style="margin-top: 24px; font-size: 16px;">
                                    %s
                                </div>

                                <div style="text-align: center; margin-top: 16px;">
                                    %s
                                </div>
                                
                            </td>
                        </tr>

                        <tr>
                            <td style="background-color: #f9f9fa; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
                                <p style="margin: 0; color: #8aaabf; font-size: 13px;">Estás recibiendo este correo porque configuraste tus preferencias en la app.</p>
                                <p style="margin: 4px 0 0 0; color: #8aaabf; font-size: 13px;">© 2026 VecFin. Todos los derechos reservados.</p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `, user.FirstName, htmlFormattedMessage, buttonHTML) // Pasamos la variable formateada acá

	msg := []byte(headers + htmlBody)

	err = smtp.SendMail(addr, auth, s.Config.Sender, to, msg)
	if err != nil {
		return fmt.Errorf("error enviando email via smtp: %w", err)
	}

	fmt.Printf("✅ Email HTML enviado exitosamente a %s\n", user.Email)
	return nil
}
