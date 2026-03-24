package usecase

import (
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase struct {
	repo      domain.UserRepository
	jwtSecret string
}

func NewAuthUsecase(repo domain.UserRepository, secret string) *AuthUsecase {
	return &AuthUsecase{repo: repo, jwtSecret: secret}
}

func (u *AuthUsecase) Login(email, password string) (string, error) {
	// 1. Buscar al usuario por email
	user, err := u.repo.FindByEmail(email)
	if err != nil {
		return "", errors.New("credenciales inválidas")
	}

	// 2. Comparar la contraseña en texto plano con el hash de la DB
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return "", errors.New("credenciales inválidas")
	}

	// 3. Generar el token JWT
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID.String(),
		"email":   user.Email,
		"exp":     time.Now().Add(time.Hour * 72).Unix(), // Expira en 3 días
	})

	// 4. Firmar el token con nuestro secreto
	tokenString, err := token.SignedString([]byte(u.jwtSecret))
	if err != nil {
		return "", errors.New("error al generar el token")
	}

	return tokenString, nil
}
