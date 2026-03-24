package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Masega360/vecfin/backend/internal/usecase"
	"github.com/Masega360/vecfin/backend/pkg/middleware"
)

type UserHandler struct {
	uc *usecase.UserUsecase
}

func NewUserHandler(uc *usecase.UserUsecase) *UserHandler {
	return &UserHandler{uc: uc}
}

func (h *UserHandler) RegisterRoutes(jwtSecret string) {
	// Pública (No requiere token)
	http.HandleFunc("POST /users", h.Create)

	// Privadas (Envueltas en el middleware RequireAuth)
	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("GET /users/{id}", auth(h.Read))
	http.HandleFunc("PUT /users/{id}", auth(h.Update))
	http.HandleFunc("DELETE /users/{id}", auth(h.Delete))
}

// DTO para la respuesta: NUNCA incluimos el password hash aquí
type UserResponse struct {
	ID               string    `json:"id"`
	FirstName        string    `json:"first_name"`
	LastName         string    `json:"last_name"`
	Email            string    `json:"email"`
	RiskType         string    `json:"risk_type"`
	RegistrationDate time.Time `json:"registration_date"`
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
		Password  string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.uc.Create(body.FirstName, body.LastName, body.Email, body.Password); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *UserHandler) Read(w http.ResponseWriter, r *http.Request) {
	// Extraemos el ID usando la nueva función PathValue
	id := r.PathValue("id")

	user, err := h.uc.Read(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Mapeamos la entidad de dominio al DTO de respuesta
	res := UserResponse{
		ID:               user.ID.String(),
		FirstName:        user.FirstName,
		LastName:         user.LastName,
		Email:            user.Email,
		RiskType:         user.RiskType,
		RegistrationDate: user.RegistrationDate,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var body struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	if err := h.uc.Update(id, body.FirstName, body.LastName, body.Email); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if err := h.uc.Delete(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
