package domain

import (
	"github.com/google/uuid"
)

type UUID = uuid.UUID

type UserRepository interface {
	Create(user User) error
	GetByID(id UUID) (User, error)
	Update(id UUID, user User) error
	Delete(id UUID) error
}
