package domain

import (
	"github.com/google/uuid"
	"time"
)

type User struct {
	ID               uuid.UUID
	FirstName        string
	LastName         string
	Email            string
	PasswordHash     string
	RiskType         string
	RegistrationDate time.Time
	LastAccess       time.Time
}
