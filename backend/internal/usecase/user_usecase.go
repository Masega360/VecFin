package usecase

import (
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type UserUsecase struct {
	repo domain.UserRepository
}

func NewUserUsecase(repo domain.UserRepository) *UserUsecase {
	return &UserUsecase{repo: repo}
}

func (u *UserUsecase) Create(firstName, lastName, email, password string) error {
	if firstName == "" || lastName == "" {
		return errors.New("El nombre y el apellido no pueden estar vacíos")
	}
	if email == "" {
		return errors.New("El email es obligatorio")
	}
	if len(password) < 8 {
		return errors.New("La contraseña debe tener al menos 8 caracteres")
	}

	if _, err := u.repo.FindByEmail(email); err == nil {
		return errors.New("El email ya está registrado")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := domain.User{
		ID:               uuid.New(),
		FirstName:        firstName,
		LastName:         lastName,
		Email:            email,
		PasswordHash:     string(hash),
		RegistrationDate: time.Now(),
	}

	return u.repo.Save(user)
}

func (u *UserUsecase) Read(id string) (domain.User, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return domain.User{}, err
	}
	// Usamos FindByID
	return u.repo.FindByID(uid)
}

func (u *UserUsecase) Update(id, firstName, lastName, email string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	existingUser, err := u.repo.FindByID(uid)
	if err != nil {
		return err
	}

	// Le decimos al objeto que se actualice a sí mismo (Modelo Rico)
	if err := existingUser.UpdateProfile(firstName, lastName, email); err != nil {
		return err
	}

	return u.repo.Update(existingUser)
}

func (u *UserUsecase) Delete(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return u.repo.Delete(uid)
}
