package infrastructure

import (
	"fmt"
	"net/smtp"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type SMTPConfig struct {
	SMTPServer string
	Port       int
	Sender     string
	Password   string
}

// Implementa la interfaz domain.NotificationProvider
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

func (s *EmailService) Send(userID uuid.UUID, title, message string) error {
	// 1. Buscar al usuario
	user, err := s.UserRepo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("no se encontró el usuario para enviar mail: %w", err)
	}

	// 2. Configurar la autenticación SMTP
	auth := smtp.PlainAuth("", s.Config.Sender, s.Config.Password, s.Config.SMTPServer)

	// 3. Armar los destinatarios y la dirección del servidor
	to := []string{user.Email}
	addr := fmt.Sprintf("%s:%d", s.Config.SMTPServer, s.Config.Port)

	// 4. Armar el mensaje (Formato RFC 822)
	// Los \r\n son obligatorios para separar los headers del cuerpo
	msg := []byte(
		"To: " + user.Email + "\r\n" +
			"Subject: " + title + "\r\n" +
			"\r\n" +
			"Hola " + user.FirstName + ",\n\n" +
			message + "\n\n" +
			"Saludos,\nEl equipo de vecFin.",
	)

	// 5. Enviar el correo
	err = smtp.SendMail(addr, auth, s.Config.Sender, to, msg)
	if err != nil {
		return fmt.Errorf("error enviando email via smtp: %w", err)
	}

	fmt.Printf("✅ Email enviado exitosamente a %s\n", user.Email)
	return nil
}
