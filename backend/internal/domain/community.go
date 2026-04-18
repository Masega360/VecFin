package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Community struct {
	ID           uuid.UUID `json:"id"`
	CreatorID    uuid.UUID `json:"creator_id"`
	Name         string    `json:"name"`
	Description  string    `json:"description"`
	Rules        string    `json:"rules"`
	Topics       []string  `json:"topics"` //["crypto", "politica", "noticias"]
	LogoUrl      string    `json:"logo_url"`
	IsPrivate    bool      `json:"is_private"`
	CreationDate time.Time `json:"creation_date"`
	MemberCount  int       `json:"member_count"`
	PostCount    int       `json:"post_count"`
}

type CommunityMember struct {
	CommunityID uuid.UUID     `json:"community_id"`
	UserID      uuid.UUID     `json:"user_id"`
	Role        CommunityRole `json:"role"`
	JoinedAt    time.Time     `json:"joined_at"`
}

type CommunityRole string

const (
	RoleOwner     CommunityRole = "owner"
	RoleModerator CommunityRole = "moderator"
	RoleMember    CommunityRole = "member"
)

type CommunityRepository interface {
	// Gestión de la comunidad
	Create(community Community) error
	FindByID(id uuid.UUID) (Community, error)
	Search(query string) ([]Community, error)
	Update(community Community) error
	Delete(id uuid.UUID) error

	// Gestión de miembros
	AddMember(member CommunityMember) error
	FindMember(communityID, userID uuid.UUID) (CommunityMember, error)
	UpdateMember(member CommunityMember) error
	RemoveMember(communityID, userID uuid.UUID) error
	CountOwners(communityID uuid.UUID) (int, error) // Útil para saber si es el único líder

	CreateJoinRequest(req JoinRequest) error
	GetJoinRequest(communityID, userID uuid.UUID) (JoinRequest, error)
	UpdateJoinRequestStatus(communityID, userID uuid.UUID, status RequestStatus) error
}

// ValidateLeave verifica si el usuario puede irse de la comunidad
func (cm *CommunityMember) ValidateLeave(isOnlyOwner bool) error {
	if cm.Role == RoleOwner && isOnlyOwner {
		return errors.New("No puedes abandonar la comunidad siendo el único líder, debes designar a un sucesor primero o eliminar la comunidad")
	}
	return nil
}

func (cm *CommunityMember) TransferOwnership(targetMember *CommunityMember) error {
	if cm.Role != RoleOwner {
		return errors.New("Solo el creador/líder actual puede transferir el mandato")
	}
	if cm.UserID == targetMember.UserID {
		return errors.New("No puedes transferirte el mandato a ti mismo")
	}

	cm.Role = RoleModerator
	targetMember.Role = RoleOwner

	return nil
}

func (cm *CommunityMember) CanDeleteCommunity() bool {
	return cm.Role == RoleOwner
}

func (cm *CommunityMember) CanKickMember(targetRole CommunityRole) bool {
	if cm.Role == RoleOwner {
		return true
	}
	if cm.Role == RoleModerator && targetRole == RoleMember {
		return true
	}
	return false
}

// PromoteToModerator asegura que solo un owner/mod pueda dar permisos
func (cm *CommunityMember) PromoteToModerator(promoterRole CommunityRole) error {
	if promoterRole != RoleOwner {
		return errors.New("Solo el creador/líder puede designar moderadores")
	}
	cm.Role = RoleModerator
	return nil
}

// PromoteToOwner permite a un líder actual designar a otro co-líder
func (cm *CommunityMember) PromoteToOwner(targetMember *CommunityMember) error {
	if cm.Role != RoleOwner {
		return errors.New("solo un líder actual puede designar a otro líder")
	}
	if cm.UserID == targetMember.UserID {
		return errors.New("ya tienes el rango de líder")
	}

	targetMember.Role = RoleOwner

	return nil
}

// CanDeletePost verifica si este miembro tiene poder para borrar posts de terceros
func (cm *CommunityMember) CanDeletePost() bool {
	return cm.Role == RoleOwner || cm.Role == RoleModerator
}

type RequestStatus string

const (
	StatusPending  RequestStatus = "pending"
	StatusApproved RequestStatus = "approved"
	StatusRejected RequestStatus = "rejected"
)

type JoinRequest struct {
	CommunityID uuid.UUID     `json:"community_id"`
	UserID      uuid.UUID     `json:"user_id"`
	Status      RequestStatus `json:"status"`
	CreatedAt   time.Time     `json:"created_at"`
}

func (cm *CommunityMember) CanManageJoinRequests() bool {
	return cm.Role == RoleOwner || cm.Role == RoleModerator
}
