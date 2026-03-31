package handler

import (
	"encoding/json"
	"net/http"
)

type AuthUsecasePort interface {
	Login(email, password string) (string, error)
	GoogleLogin(idToken string) (string, error)
}

type AuthHandler struct {
	uc AuthUsecasePort
}

func NewAuthHandler(uc AuthUsecasePort) *AuthHandler {
	return &AuthHandler{uc: uc}
}

func (h *AuthHandler) RegisterRoutes() {
	http.HandleFunc("POST /auth/login", h.Login)
	http.HandleFunc("POST /auth/google", h.GoogleLogin)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	token, err := h.uc.Login(body.Email, body.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDToken string `json:"id_token"`
	}

	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.IDToken == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	token, err := h.uc.GoogleLogin(body.IDToken)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}
