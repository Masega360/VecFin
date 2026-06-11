package domain

import (
	"time"

	"github.com/google/uuid"
)

type FollowStatus string

const (
	FollowStatusPending  FollowStatus = "pending"
	FollowStatusApproved FollowStatus = "approved"
	FollowStatusCanceled FollowStatus = "canceled"
)

type FollowRelationship struct {
	FollowerID  uuid.UUID    `json:"follower_id"`
	FollowingID uuid.UUID    `json:"following_id"`
	Status      FollowStatus `json:"status"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type FollowRepository interface {
	Create(follow FollowRelationship) error
	UpdateStatus(followerID, followingID uuid.UUID, status FollowStatus) error
	Delete(followerID, followingID uuid.UUID) error
	CheckStatus(followerID, followingID uuid.UUID) (FollowStatus, error)
	GetRelationship(followerID, followingID uuid.UUID) (FollowRelationship, error)

	GetFollowerIDs(targetID uuid.UUID, status FollowStatus) ([]uuid.UUID, error)
	GetFollowingIDs(followerID uuid.UUID, status FollowStatus) ([]uuid.UUID, error)
}
