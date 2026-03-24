package usecase

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
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
	user, err := u.repo.FindByEmail(email)
	if err != nil {
		return "", errors.New("credenciales inválidas")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return "", errors.New("credenciales inválidas")
	}

	return u.generateJWT(user)
}

func (u *AuthUsecase) GoogleLogin(idToken string) (string, error) {
	// 1. Verificar el token con Google
	resp, err := http.Get(fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", idToken))
	if err != nil {
		return "", errors.New("error al verificar token de Google")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", errors.New("token de Google inválido")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", errors.New("error al leer respuesta de Google")
	}

	var googleInfo struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		GivenName     string `json:"given_name"`
		FamilyName    string `json:"family_name"`
		EmailVerified string `json:"email_verified"`
	}
	if err := json.Unmarshal(body, &googleInfo); err != nil {
		return "", errors.New("error al parsear respuesta de Google")
	}

	if googleInfo.Sub == "" {
		return "", errors.New("token de Google inválido")
	}

	// 2. Buscar usuario existente por google_id
	user, err := u.repo.FindByGoogleID(googleInfo.Sub)
	if err != nil {
		// 3. Si no existe, buscar por email (puede tener cuenta manual)
		user, err = u.repo.FindByEmail(googleInfo.Email)
		if err != nil {
			// 4. Si tampoco existe, crear usuario nuevo
			user = domain.User{
				ID:               uuid.New(),
				FirstName:        googleInfo.GivenName,
				LastName:         googleInfo.FamilyName,
				Email:            googleInfo.Email,
				GoogleID:         googleInfo.Sub,
				RiskType:         "medium",
				RegistrationDate: time.Now(),
			}
			if err := u.repo.Save(user); err != nil {
				return "", errors.New("error al crear usuario")
			}
		} else {
			// Vincular google_id a cuenta existente
			user.GoogleID = googleInfo.Sub
			u.repo.Update(user)
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
