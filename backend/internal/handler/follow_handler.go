package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/Masega360/vecfin/backend/internal/usecase"
	"github.com/google/uuid"
)

func mapUsersToResponse(users []domain.User) []UserResponse {
	var res []UserResponse
	for _, u := range users {
		res = append(res, UserResponse{
			ID:               u.ID.String(),
			FirstName:        u.FirstName,
			LastName:         u.LastName,
			Email:            u.Email,
			RiskType:         u.RiskType,
			RegistrationDate: u.RegistrationDate,
		})
	}
	if res == nil {
		res = make([]UserResponse, 0)
	}
	return res
}

type FollowUsecasePort interface {
	FollowUser(followerID, targetID uuid.UUID) error
	GetProfileVisibility(viewerID, targetID uuid.UUID) (usecase.ProfileVisibility, error)
	AcceptFollowRequest(ownerID, followerID uuid.UUID) error
	RejectFollowRequest(ownerID, followerID uuid.UUID) error
	UnfollowUser(followerID, targetID uuid.UUID) error
	GetFollowers(targetID uuid.UUID) ([]domain.User, error)
	GetFollowing(followerID uuid.UUID) ([]domain.User, error)
	GetPendingRequests(ownerID uuid.UUID) ([]domain.User, error)
}

type FollowHandler struct {
	uc FollowUsecasePort
}

func NewFollowHandler(uc FollowUsecasePort) *FollowHandler {
	return &FollowHandler{uc: uc}
}

func (h *FollowHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("POST /users/{id}/follow", auth(h.FollowUser))
	http.HandleFunc("DELETE /users/{id}/follow", auth(h.UnfollowUser))

	http.HandleFunc("GET /users/{id}/public-profile", auth(h.GetProfileVisibility))

	http.HandleFunc("POST /users/followers/{id}/accept", auth(h.AcceptFollowRequest))
	http.HandleFunc("POST /users/followers/{id}/reject", auth(h.RejectFollowRequest))
	http.HandleFunc("GET /users/me/follow-requests", auth(h.GetPendingRequests))

	http.HandleFunc("GET /users/{id}/followers", auth(h.GetFollowers))
	http.HandleFunc("GET /users/{id}/following", auth(h.GetFollowing))
}

func (h *FollowHandler) FollowUser(w http.ResponseWriter, r *http.Request) {
	targetIDStr := r.PathValue("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		http.Error(w, "ID de usuario a seguir inválido", http.StatusBadRequest)
		return
	}

	viewerIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	viewerID, err := uuid.Parse(viewerIDStr)
	if err != nil {
		http.Error(w, "ID de token inválido", http.StatusUnauthorized)
		return
	}

	if err := h.uc.FollowUser(viewerID, targetID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *FollowHandler) GetProfileVisibility(w http.ResponseWriter, r *http.Request) {
	targetIDStr := r.PathValue("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		http.Error(w, "ID de perfil inválido", http.StatusBadRequest)
		return
	}

	viewerIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	viewerID, err := uuid.Parse(viewerIDStr)
	if err != nil {
		http.Error(w, "ID de token inválido", http.StatusUnauthorized)
		return
	}

	profileVisibility, err := h.uc.GetProfileVisibility(viewerID, targetID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	user := profileVisibility.User
	res := map[string]interface{}{
		"id":                  user.ID.String(),
		"first_name":          user.FirstName,
		"last_name":           user.LastName,
		"is_private":          user.Privacy.IsPrivate,
		"wallets_visible":     profileVisibility.CanSeeWallets,
		"communities_visible": profileVisibility.CanSeeCommunities,
		"posts_visible":       profileVisibility.CanSeePosts,
	}

	// Si tuviéramos que devolver las wallets y comunidades acá directamente,
	// consultaríamos a sus respectivos usecases usando el boolean como bandera.

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *FollowHandler) AcceptFollowRequest(w http.ResponseWriter, r *http.Request) {
	followerIDStr := r.PathValue("id") // El ID del usuario que envió la solicitud
	followerID, err := uuid.Parse(followerIDStr)
	if err != nil {
		http.Error(w, "ID de seguidor inválido", http.StatusBadRequest)
		return
	}

	ownerIDStr, _ := r.Context().Value(middleware.UserIDKey).(string)
	ownerID, _ := uuid.Parse(ownerIDStr)

	if err := h.uc.AcceptFollowRequest(ownerID, followerID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *FollowHandler) RejectFollowRequest(w http.ResponseWriter, r *http.Request) {
	followerIDStr := r.PathValue("id")
	followerID, err := uuid.Parse(followerIDStr)
	if err != nil {
		http.Error(w, "ID de seguidor inválido", http.StatusBadRequest)
		return
	}

	ownerIDStr, _ := r.Context().Value(middleware.UserIDKey).(string)
	ownerID, _ := uuid.Parse(ownerIDStr)

	if err := h.uc.RejectFollowRequest(ownerID, followerID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *FollowHandler) UnfollowUser(w http.ResponseWriter, r *http.Request) {
	targetIDStr := r.PathValue("id") // El ID del usuario que quiero dejar de seguir
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		http.Error(w, "ID de usuario objetivo inválido", http.StatusBadRequest)
		return
	}

	viewerIDStr, _ := r.Context().Value(middleware.UserIDKey).(string)
	viewerID, _ := uuid.Parse(viewerIDStr)

	if err := h.uc.UnfollowUser(viewerID, targetID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *FollowHandler) GetFollowers(w http.ResponseWriter, r *http.Request) {
	targetIDStr := r.PathValue("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		http.Error(w, "ID de usuario inválido", http.StatusBadRequest)
		return
	}

	// Aunque es un endpoint público (si tienes sesión), el Auth middleware ya validó el token.
	users, err := h.uc.GetFollowers(targetID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mapUsersToResponse(users))
}

func (h *FollowHandler) GetFollowing(w http.ResponseWriter, r *http.Request) {
	targetIDStr := r.PathValue("id")
	targetID, err := uuid.Parse(targetIDStr)
	if err != nil {
		http.Error(w, "ID de usuario inválido", http.StatusBadRequest)
		return
	}

	users, err := h.uc.GetFollowing(targetID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mapUsersToResponse(users))
}

func (h *FollowHandler) GetPendingRequests(w http.ResponseWriter, r *http.Request) {
	// Aquí usamos el ID del token, porque un usuario solo puede ver SUS propias solicitudes pendientes
	ownerIDStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	ownerID, err := uuid.Parse(ownerIDStr)
	if err != nil {
		http.Error(w, "ID de token inválido", http.StatusUnauthorized)
		return
	}

	users, err := h.uc.GetPendingRequests(ownerID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(mapUsersToResponse(users))
}
