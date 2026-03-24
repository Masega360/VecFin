package domain

import (
	"github.com/google/uuid"
)

type UserRepository interface {
	Save(user User) error
	FindByID(id uuid.UUID) (User, error)
	FindByEmail(email string) (User, error) // Agregado porque lo vas a necesitar para el Login
	Update(user User) error
	Delete(id uuid.UUID) error
}
