package usecase

import (
	"errors"
	"fmt"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type FollowNotificationDispatcher interface {
	DispatchFollowRequest(targetUserID uuid.UUID, followerName string)
}

type FollowUsecase struct {
	followRepo domain.FollowRepository
	userRepo   domain.UserRepository
	dispatcher FollowNotificationDispatcher
}

func NewFollowUseCase(
	repo domain.FollowRepository,
	userRepo domain.UserRepository,
	dispatcher FollowNotificationDispatcher,
) *FollowUsecase {
	return &FollowUsecase{
		followRepo: repo,
		userRepo:   userRepo,
		dispatcher: dispatcher,
	}
}

func (u *FollowUsecase) FollowUser(followerID, targetID uuid.UUID) error {
	if followerID == targetID {
		return errors.New("no puedes seguirte a ti mismo")
	}

	targetUser, err := u.userRepo.FindByID(targetID)
	if err != nil {
		return errors.New("usuario objetivo no encontrado")
	}

	status := domain.FollowStatusApproved
	if targetUser.Privacy.IsPrivate {
		status = domain.FollowStatusPending
	}

	existingRel, err := u.followRepo.GetRelationship(followerID, targetID)

	if err == nil {
		switch existingRel.Status {
		case domain.FollowStatusPending:
			return errors.New("ya has enviado una solicitud a este usuario")
		case domain.FollowStatusApproved:
			return errors.New("ya sigues a este usuario")
		case domain.FollowStatusCanceled:
			tiempoTranscurrido := time.Since(existingRel.UpdatedAt)
			tiempoRequerido := 24 * time.Hour

			if tiempoTranscurrido < tiempoRequerido {
				faltan := (tiempoRequerido - tiempoTranscurrido).Hours()
				return fmt.Errorf("debes esperar %.0f horas para volver a enviar una solicitud", faltan)
			}

			err = u.followRepo.UpdateStatus(followerID, targetID, status)
		}
	} else {
		follow := domain.FollowRelationship{
			FollowerID:  followerID,
			FollowingID: targetID,
			Status:      status,
			CreatedAt:   time.Now(),
		}
		err = u.followRepo.Create(follow)
	}

	if err != nil {
		return err
	}

	if status == domain.FollowStatusPending {
		follower, _ := u.userRepo.FindByID(followerID)
		u.dispatcher.DispatchFollowRequest(targetID, follower.FirstName)
	}

	return nil
}

type ProfileVisibility struct {
	User              domain.User
	CanSeeWallets     bool
	CanSeeCommunities bool
	CanSeePosts       bool
}

func (u *FollowUsecase) GetProfileVisibility(viewerID, targetID uuid.UUID) (ProfileVisibility, error) {

	targetUser, err := u.userRepo.FindByID(targetID)
	if err != nil {
		return ProfileVisibility{domain.User{}, false, false, false}, err
	}

	canSeeWallets := false
	canSeeCommunities := false
	canSeePosts := false

	if viewerID == targetID {
		// Es el mismo usuario, puede ver todo
		return ProfileVisibility{targetUser, true, true, true}, nil
	}

	// Verificar si lo sigue y fue aprobado
	status, err := u.followRepo.CheckStatus(viewerID, targetID)
	isApprovedFollower := (err == nil && status == domain.FollowStatusApproved)

	// Si la cuenta es privada y NO es seguidor aprobado, no devolvemos datos sensibles
	if targetUser.Privacy.IsPrivate && !isApprovedFollower {
		return ProfileVisibility{targetUser, false, false, false}, nil
	}

	canSeeWallets = targetUser.Privacy.ShowWallets
	canSeeCommunities = targetUser.Privacy.ShowCommunities
	canSeePosts = targetUser.Privacy.ShowCommunityPosts

	return ProfileVisibility{targetUser, canSeeWallets, canSeeCommunities, canSeePosts}, nil
}

func (u *FollowUsecase) AcceptFollowRequest(ownerID, followerID uuid.UUID) error {
	status, err := u.followRepo.CheckStatus(followerID, ownerID)

	if err != nil {
		return err
	}

	if status != domain.FollowStatusPending {
		return errors.New("la solicitud no esta pendiente")
	}
	return u.followRepo.UpdateStatus(followerID, ownerID, domain.FollowStatusApproved)
}

func (u *FollowUsecase) RejectFollowRequest(ownerID, followerID uuid.UUID) error {
	status, err := u.followRepo.CheckStatus(followerID, ownerID)
	if err != nil {
		return err
	}

	if status != domain.FollowStatusPending {
		return errors.New("la solicitud no está pendiente")
	}

	return u.followRepo.UpdateStatus(followerID, ownerID, domain.FollowStatusCanceled)
}

func (u *FollowUsecase) UnfollowUser(followerID, targetID uuid.UUID) error {
	return u.followRepo.UpdateStatus(followerID, targetID, domain.FollowStatusCanceled)
}

func (u *FollowUsecase) GetFollowers(targetID uuid.UUID) ([]domain.User, error) {
	followerIDs, err := u.followRepo.GetFollowerIDs(targetID, domain.FollowStatusApproved)
	if err != nil {
		return nil, err
	}

	if len(followerIDs) == 0 {
		return []domain.User{}, nil
	}

	return u.userRepo.FindManyByIDs(followerIDs)
}

func (u *FollowUsecase) GetFollowing(followerID uuid.UUID) ([]domain.User, error) {
	followingIDs, err := u.followRepo.GetFollowingIDs(followerID, domain.FollowStatusApproved)
	if err != nil {
		return nil, err
	}

	if len(followingIDs) == 0 {
		return []domain.User{}, nil
	}

	return u.userRepo.FindManyByIDs(followingIDs)
}

func (u *FollowUsecase) GetPendingRequests(ownerID uuid.UUID) ([]domain.User, error) {
	pendingIDs, err := u.followRepo.GetFollowerIDs(ownerID, domain.FollowStatusPending)
	if err != nil {
		return nil, err
	}

	if len(pendingIDs) == 0 {
		return []domain.User{}, nil
	}

	return u.userRepo.FindManyByIDs(pendingIDs)
}
