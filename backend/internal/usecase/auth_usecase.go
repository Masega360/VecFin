package usecase

import (
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase struct {
	repo           domain.UserRepository
	jwtSecret      string
	googleVerifier domain.GoogleVerifier
}

func NewAuthUsecase(repo domain.UserRepository, secret string, googleVerifier domain.GoogleVerifier) *AuthUsecase {
	return &AuthUsecase{repo: repo, jwtSecret: secret, googleVerifier: googleVerifier}
}

func (u *AuthUsecase) Login(email, password string) (string, error) {
	user, err := u.repo.FindByEmail(email)
	if err != nil {
		return "", errors.New("credenciales inválidas")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", errors.New("credenciales inválidas")
	}

	return u.generateJWT(user)
}

func (u *AuthUsecase) GoogleLogin(idToken string) (string, error) {
	info, err := u.googleVerifier.Verify(idToken)
	if err != nil {
		return "", err
	}

	// Buscar usuario existente por google_id
	user, err := u.repo.FindByGoogleID(info.Sub)
	if err != nil {
		// Si no existe, buscar por email (puede tener cuenta manual)
		user, err = u.repo.FindByEmail(info.Email)
		if err != nil {
			// Si tampoco existe, crear usuario nuevo
			user = domain.User{
				ID:               uuid.New(),
				FirstName:        info.GivenName,
				LastName:         info.FamilyName,
				Email:            info.Email,
				GoogleID:         info.Sub,
				RiskType:         "medium",
				RegistrationDate: time.Now(),
			}
			if err := u.repo.Save(user); err != nil {
				return "", errors.New("error al crear usuario")
			}
		} else {
			// Vincular google_id a cuenta existente
			user.GoogleID = info.Sub
			if err := u.repo.Update(user); err != nil {
				return "", errors.New("error al vincular cuenta de Google")
			}
		}
	}

	return u.generateJWT(user)
}

func (u *AuthUsecase) generateJWT(user domain.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID.String(),
		"email":   user.Email,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	})

	tokenString, err := token.SignedString([]byte(u.jwtSecret))
	if err != nil {
		return "", errors.New("error al generar el token")
	}
	return tokenString, nil
}
