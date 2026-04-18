package usecase

import (
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type CommunityUsecase struct {
	repo domain.CommunityRepository
}

func NewCommunityUsecase(repo domain.CommunityRepository) *CommunityUsecase {
	return &CommunityUsecase{repo: repo}
}

func (u *CommunityUsecase) CreateCommunity(creatorID uuid.UUID, name, desc, rules, logo string, isPrivate bool) error {
	if name == "" && desc == "" && rules == "" {
		return errors.New("La comunidad debe tener nombre, descripcion y reglas")
	}
	if len(name) >= 64 {
		return errors.New("El nombre no puede superar los 64 caracteres")
	}
	if len(desc) >= 512 {
		return errors.New("La descripcion no debe superar los 512 caracteres")
	}
	if len(rules) >= 512 {
		return errors.New("Las reglas no debe superar los 512 caracteres")
	}

	communityID := uuid.New()

	community := domain.Community{
		ID:           communityID,
		CreatorID:    creatorID,
		Name:         name,
		Description:  desc,
		Rules:        rules,
		LogoUrl:      logo,
		IsPrivate:    isPrivate,
		CreationDate: time.Now(),
		MemberCount:  1,
		PostCount:    0,
	}

	if err := u.repo.Create(community); err != nil {
		return err
	}

	owner := domain.CommunityMember{
		CommunityID: communityID,
		UserID:      creatorID,
		Role:        domain.RoleOwner,
		JoinedAt:    time.Now(),
	}

	return u.repo.AddMember(owner)
}

func (u *CommunityUsecase) JoinCommunity(communityID, userID uuid.UUID) error {
	// Verifica si ya es miembro (para no duplicarlo)
	if _, err := u.repo.FindMember(communityID, userID); err == nil {
		return errors.New("El usuario ya pertenece a esta comunidad")
	}

	comm, err := u.repo.FindByID(communityID)
	if err != nil {
		return err
	}

	if comm.IsPrivate == true {
		if req, err := u.repo.GetJoinRequest(communityID, userID); err == nil && req.Status == domain.StatusPending {
			return errors.New("Ya tenes una solisitud pendiente")
		}
		request := domain.JoinRequest{
			CommunityID: communityID,
			UserID:      userID,
			Status:      domain.StatusPending,
			CreatedAt:   time.Now(),
		}
		return u.repo.CreateJoinRequest(request)
	} else {
		// si cm es public
		member := domain.CommunityMember{
			CommunityID: communityID,
			UserID:      userID,
			Role:        domain.RoleMember,
			JoinedAt:    time.Now(),
		}
		if err := u.repo.AddMember(member); err != nil {
			return err
		}

		comm.MemberCount++
		return u.repo.Update(comm)
	}
}

func (u *CommunityUsecase) ResolveJoinRequest(communityID, moderatorID, applicantID uuid.UUID, approve bool) error {
	// Verificar permisos del moderador
	mod, err := u.repo.FindMember(communityID, moderatorID)
	if err != nil || !mod.CanManageJoinRequests() {
		return errors.New("No tienes permisos para gestionar solicitudes")
	}

	req, err := u.repo.GetJoinRequest(communityID, applicantID)
	if err != nil || req.Status != domain.StatusPending {
		return errors.New("no hay una solicitud pendiente para este usuario")
	}

	// Rechazar
	if !approve {
		return u.repo.UpdateJoinRequestStatus(communityID, applicantID, domain.StatusRejected)
	}

	// Aprobar
	if err := u.repo.UpdateJoinRequestStatus(communityID, applicantID, domain.StatusApproved); err != nil {
		return err
	}

	newMember := domain.CommunityMember{
		CommunityID: communityID,
		UserID:      applicantID,
		Role:        domain.RoleMember,
		JoinedAt:    time.Now(),
	}

	if err := u.repo.AddMember(newMember); err != nil {
		return err
	}
	comm, _ := u.repo.FindByID(communityID)
	comm.MemberCount++
	return u.repo.Update(comm)
}

func (u *CommunityUsecase) KickMember(communityID, initiatorID, targetID uuid.UUID) error {
	initiator, err := u.repo.FindMember(communityID, initiatorID)
	if err != nil {
		return errors.New("No sos miembro de esta comunidad")
	}

	target, err := u.repo.FindMember(communityID, targetID)
	if err != nil {
		return errors.New("El usuario objetivo no está en la comunidad")
	}

	if !initiator.CanKickMember(target.Role) {
		return errors.New("No tienes permiso para expulsar a este usuario")
	}

	if err := u.repo.RemoveMember(communityID, targetID); err != nil {
		return err
	}

	comm, _ := u.repo.FindByID(communityID)
	comm.MemberCount--
	return u.repo.Update(comm)
}

func (u *CommunityUsecase) TransferOwnership(communityID, currentOwnerID, newOwnerID uuid.UUID) error {
	currentOwner, err := u.repo.FindMember(communityID, currentOwnerID)
	if err != nil {
		return err
	}

	newOwner, err := u.repo.FindMember(communityID, newOwnerID)
	if err != nil {
		return errors.New("El nuevo líder debe ser ya miembro de la comunidad")
	}

	if err := currentOwner.TransferOwnership(&newOwner); err != nil {
		return err
	}

	if err := u.repo.UpdateMember(currentOwner); err != nil {
		return err
	}
	return u.repo.UpdateMember(newOwner)
}

func (u *CommunityUsecase) PromoteToOwner(communityID, currentOwnerID, newOwnerID uuid.UUID) error {
	currentOwner, err := u.repo.FindMember(communityID, currentOwnerID)
	if err != nil {
		return err
	}

	newOwner, err := u.repo.FindMember(communityID, newOwnerID)
	if err != nil {
		return errors.New("el nuevo líder debe ser ya miembro de la comunidad")
	}

	if err := currentOwner.PromoteToOwner(&newOwner); err != nil {
		return err
	}

	return u.repo.UpdateMember(newOwner)
}

// VER PERFIL DE COMUNIDAD
func (u *CommunityUsecase) GetCommunity(communityID uuid.UUID) (domain.Community, error) {
	return u.repo.FindByID(communityID)
}

// BUSCAR COMUNIDADES
func (u *CommunityUsecase) SearchCommunities(query string) ([]domain.Community, error) {
	// Si la búsqueda está vacía, no tiene sentido ir a la base de datos
	if query == "" {
		return nil, errors.New("El término de búsqueda no puede estar vacío")
	}
	return u.repo.Search(query)
}

// BORRAR COMUNIDAD
func (u *CommunityUsecase) DeleteCommunity(communityID, userID uuid.UUID) error {
	member, err := u.repo.FindMember(communityID, userID)
	if err != nil {
		return errors.New("No eres miembro de esta comunidad")
	}

	if !member.CanDeleteCommunity() {
		return errors.New("Solo el creador o líder principal puede borrar la comunidad")
	}

	return u.repo.Delete(communityID)
}
