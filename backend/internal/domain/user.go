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
	RiskType         RiskType
	RegistrationDate time.Time
	Privacy          PrivacySettings
}

type PrivacySettings struct {
	IsPrivate          bool `json:"is_private"`
	ShowWallets        bool `json:"show_wallets"`
	ShowCommunities    bool `json:"show_communities"`
	ShowCommunityPosts bool `json:"show_community_posts"`
}

type RiskType string

const (
	ConservativeRisk RiskType = "conservative"
	ModerateRisk     RiskType = "moderate"
	AggressiveRisk   RiskType = "aggressive"
)

// UpdateProfile actualiza solo datos personales
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

// UpdateRiskProfile cambia el perfil de riesgo
func (u *User) UpdateRiskProfile(riskType RiskType) error {
	if riskType != ConservativeRisk && riskType != ModerateRisk && riskType != AggressiveRisk {
		return errors.New("perfil de riesgo inválido")
	}
	u.RiskType = riskType
	return nil
}

// UpdatePrivacy actualiza las configuraciones de privacidad juntas
func (u *User) UpdatePrivacy(isPrivate, showWallet, showCommunities, showCommunitiesPost bool) {
	u.Privacy.IsPrivate = isPrivate
	u.Privacy.ShowWallets = showWallet
	u.Privacy.ShowCommunities = showCommunities
	u.Privacy.ShowCommunityPosts = showCommunitiesPost
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
