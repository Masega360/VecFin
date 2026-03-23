package usecase

import (
	"time"

	"github.com/Masega360/vecfin/internal/domain"
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

	return u.repo.Create(user)
}

func (u *UserUsecase) Read(id string) (domain.User, error) {
	uid, err := uuid.Parse(id)
	if err != nil {
		return domain.User{}, err
	}
	return u.repo.Read(uid)
}

func (u *UserUsecase) Update(id, firstName, lastName, email string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}

	existingUser, err := u.repo.Read(uid)
	if err != nil {
		return err
	}

	existingUser.FirstName = firstName
	existingUser.LastName = lastName
	existingUser.Email = email

	return u.repo.Update(existingUser)
}

func (u *UserUsecase) Delete(id string) error {
	uid, err := uuid.Parse(id)
	if err != nil {
		return err
	}
	return u.repo.Delete(uid)
}
