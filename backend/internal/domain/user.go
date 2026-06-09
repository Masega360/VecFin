package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

// User representa la entidad principal del dominio
type User struct {
	ID               uuid.UUID
	FirstName        string
	LastName         string
	Email            string
	PasswordHash     string
	GoogleID         string
	RiskType         string
	RegistrationDate time.Time
	Privacy          PrivacySettings
}

// UpdateProfile es un método de dominio que controla cómo se modifica un usuario.
// Aquí centralizamos las reglas de negocio (ej. validaciones).
func (u *User) UpdateProfile(firstName, lastName, email string) error {
	if firstName == "" || lastName == "" {
		return errors.New("el nombre y el apellido no pueden estar vacíos")
	}
	if email == "" {
		return errors.New("el email es obligatorio")
	}

	// Aquí podrías agregar lógica para validar el formato del email si quisieras

	u.FirstName = firstName
	u.LastName = lastName
	u.Email = email

	return nil
}

// UpdateRiskProfile cambia el perfil de riesgo del usuario
func (u *User) UpdateRiskProfile(riskType string) {
	u.RiskType = riskType
}

func (u *User) UpdatePrivacy(isPrivate, showWallet, showCommunities, showCommunitiesPost bool) {
	u.Privacy.IsPrivate = isPrivate
	u.Privacy.ShowWallets = showWallet
	u.Privacy.ShowCommunities = showCommunities
	u.Privacy.ShowCommunityPosts = showCommunitiesPost
}

type PrivacySettings struct {
	IsPrivate          bool
	ShowWallets        bool
	ShowCommunities    bool
	ShowCommunityPosts bool
}

type UserRepository interface {
	Save(user User) error
	FindByID(id uuid.UUID) (User, error)
	FindByEmail(email string) (User, error)
	FindByGoogleID(googleID string) (User, error)
	Update(user User) error
	Delete(id uuid.UUID) error
	FindManyByIDs(ids []uuid.UUID) ([]User, error)
}
