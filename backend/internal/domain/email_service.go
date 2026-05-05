package domain

import (
	"fmt"

	"github.com/google/uuid"
)

type SMTPConfig struct {
	SMTPServer string
	Port       int
	Sender     string
	Password   string
}

type EmailService struct {
	// Aquí podrías tener tu conexión a DB o un UserRepository
	UserRepo UserRepository
	Config   SMTPConfig
}

func (s *EmailService) Send(userID uuid.UUID, title, message string) error {
	user, err := s.UserRepo.FindByID(userID)
	if err != nil {
		return fmt.Errorf("no se pudo encontrar el usuario: %w", err)
	}

	// 2. Lógica para enviar el mail a user.Email
	fmt.Printf("📧 Enviando Email a %s (%s): %s\n", user.FirstName, user.Email, title)

	// Aquí usarías net/smtp o un servicio como SendGrid/Mailgun
	return nil
}
