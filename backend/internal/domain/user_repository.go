package domain

import (
	"github.com/google/uuid"
)

type UserRepository interface {
	Save(user User) error
	FindByID(id uuid.UUID) (User, error)
	FindByEmail(email string) (User, error)
	FindByGoogleID(googleID string) (User, error)
	Update(user User) error
	Delete(id uuid.UUID) error
}
