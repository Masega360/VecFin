package backend.internal.repository

type UserRepository interface {
	Create(user User) error
	GetByID(id UUID) (User, error)
	Update(user User) error
	Delete(id UUID) error
}