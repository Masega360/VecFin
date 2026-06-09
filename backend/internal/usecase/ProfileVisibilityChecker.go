package usecase

import "github.com/google/uuid"

type ProfileVisibilityChecker interface {
	GetProfileVisibility(viewerID, targetID uuid.UUID) (ProfileVisibility, error)
}
