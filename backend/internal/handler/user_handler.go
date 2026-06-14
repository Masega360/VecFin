package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
)

type UserUsecasePort interface {
	Create(firstName, lastName, email, password string) error
	Read(id string) (domain.User, error)
	Delete(id string) error
	UpdateProfile(id, firstName, lastName, email string) error
	UpdateRiskProfile(id string, riskType string) error
	UpdatePrivacy(id string, isPrivate, showWallet, showCommunities, showCommunitiesPost bool) error
}

type UserHandler struct {
	uc UserUsecasePort
}

func NewUserHandler(uc UserUsecasePort) *UserHandler {
	return &UserHandler{uc: uc}
}

func (h *UserHandler) RegisterRoutes(jwtSecret string) {
	http.HandleFunc("POST /users", h.Create)

	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("GET /profile", auth(h.GetProfile))
	http.HandleFunc("GET /users/{id}", auth(h.Read))
	http.HandleFunc("DELETE /users/{id}", auth(h.Delete))

	// Rutas segmentadas de Update
	http.HandleFunc("PUT /users/{id}/profile", auth(h.UpdateProfile))
	http.HandleFunc("PUT /users/{id}/risk", auth(h.UpdateRiskProfile))
	http.HandleFunc("PUT /users/{id}/privacy", auth(h.UpdatePrivacy))
}

type UserResponse struct {
	ID               string                 `json:"id"`
	FirstName        string                 `json:"first_name"`
	LastName         string                 `json:"last_name"`
	Email            string                 `json:"email"`
	RiskType         string                 `json:"risk_type"`
	RegistrationDate time.Time              `json:"registration_date"`
	Privacy          domain.PrivacySettings `json:"privacy"`
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
		Password  string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}
	if err := h.uc.Create(body.FirstName, body.LastName, body.Email, body.Password); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *UserHandler) Read(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	user, err := h.uc.Read(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	res := UserResponse{
		ID:               user.ID.String(),
		FirstName:        user.FirstName,
		LastName:         user.LastName,
		Email:            user.Email,
		RiskType:         string(user.RiskType),
		RegistrationDate: user.RegistrationDate,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.uc.Delete(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No se encontró el ID válido en el token", http.StatusUnauthorized)
		return
	}

	user, err := h.uc.Read(userID)
	if err != nil {
		http.Error(w, "Usuario no encontrado: "+err.Error(), http.StatusNotFound)
		return
	}

	res := UserResponse{
		ID:               user.ID.String(),
		FirstName:        user.FirstName,
		LastName:         user.LastName,
		Email:            user.Email,
		RiskType:         string(user.RiskType),
		RegistrationDate: user.RegistrationDate,
		Privacy:          user.Privacy,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	if err := h.uc.UpdateProfile(id, body.FirstName, body.LastName, body.Email); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *UserHandler) UpdateRiskProfile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		RiskType string `json:"risk_type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	if err := h.uc.UpdateRiskProfile(id, body.RiskType); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *UserHandler) UpdatePrivacy(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var body struct {
		IsPrivate          bool `json:"is_private"`
		ShowWallets        bool `json:"show_wallets"`
		ShowCommunities    bool `json:"show_communities"`
		ShowCommunityPosts bool `json:"show_community_posts"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	if err := h.uc.UpdatePrivacy(id, body.IsPrivate, body.ShowWallets, body.ShowCommunities, body.ShowCommunityPosts); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}
