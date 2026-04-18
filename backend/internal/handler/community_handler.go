package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type CommunityUsecasePort interface {
	CreateCommunity(creatorID uuid.UUID, name, desc, rules, logo string, isPrivate bool) error
	JoinCommunity(communityID, userID uuid.UUID) error
	KickMember(communityID, initiatorID, targetID uuid.UUID) error
	PromoteToOwner(communityID, currentOwnerID, newOwnerID uuid.UUID) error
	ResolveJoinRequest(communityID, moderatorID, applicantID uuid.UUID, approve bool) error

	DeleteCommunity(communityID, userID uuid.UUID) error
	SearchCommunities(query string) ([]domain.Community, error)
	GetCommunity(communityID uuid.UUID) (domain.Community, error) // Para ver el perfil de la comunidad
}

type CommunityHandler struct {
	uc CommunityUsecasePort
}

func NewCommunityHandler(uc CommunityUsecasePort) *CommunityHandler {
	return &CommunityHandler{uc: uc}
}

// 2. Registramos las rutas (Todas protegidas por JWT)
func (h *CommunityHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("POST /communities", auth(h.Create))
	http.HandleFunc("GET /communities/search", h.Search)
	http.HandleFunc("GET /communities/{id}", auth(h.Get)) // Ver perfil
	http.HandleFunc("DELETE /communities/{id}", auth(h.Delete))
	http.HandleFunc("POST /communities/{id}/join", auth(h.Join))
	http.HandleFunc("POST /communities/{id}/kick", auth(h.Kick))
	http.HandleFunc("POST /communities/{id}/promote", auth(h.Promote))
	http.HandleFunc("POST /communities/{id}/requests/resolve", auth(h.ResolveRequest))

}

// ==========================================
// ENDPOINTS
// ==========================================

// 1. Crear Comunidad
func (h *CommunityHandler) Create(w http.ResponseWriter, r *http.Request) {
	creatorID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Rules       string `json:"rules"`
		LogoUrl     string `json:"logo_url"`
		IsPrivate   bool   `json:"is_private"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Solicitud inválida", http.StatusBadRequest)
		return
	}

	if err := h.uc.CreateCommunity(creatorID, body.Name, body.Description, body.Rules, body.LogoUrl, body.IsPrivate); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *CommunityHandler) Search(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Falta el término de búsqueda", http.StatusBadRequest)
		return
	}

	comms, err := h.uc.SearchCommunities(query)
	if err != nil {
		http.Error(w, "Error en la búsqueda", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comms)
}

func (h *CommunityHandler) Get(w http.ResponseWriter, r *http.Request) {
	commID, _ := uuid.Parse(r.PathValue("id"))

	comm, err := h.uc.GetCommunity(commID)
	if err != nil {
		http.Error(w, "Comunidad no encontrada", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comm)
}

func (h *CommunityHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))

	if err := h.uc.DeleteCommunity(commID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// 2. Unirse a una Comunidad
func (h *CommunityHandler) Join(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	commID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "ID de comunidad inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.JoinCommunity(commID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// 3. Expulsar a un Miembro
func (h *CommunityHandler) Kick(w http.ResponseWriter, r *http.Request) {
	initiatorID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	commID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "ID de comunidad inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Solicitud inválida", http.StatusBadRequest)
		return
	}

	targetID, _ := uuid.Parse(body.TargetID)
	if err := h.uc.KickMember(commID, initiatorID, targetID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// 4. Promover a Owner (Co-Líder)
func (h *CommunityHandler) Promote(w http.ResponseWriter, r *http.Request) {
	currentOwnerID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	commID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "ID de comunidad inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Solicitud inválida", http.StatusBadRequest)
		return
	}

	newOwnerID, _ := uuid.Parse(body.TargetID)
	if err := h.uc.PromoteToOwner(commID, currentOwnerID, newOwnerID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// 5. Aprobar o Rechazar Solicitudes
func (h *CommunityHandler) ResolveRequest(w http.ResponseWriter, r *http.Request) {
	moderatorID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	commID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "ID de comunidad inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		ApplicantID string `json:"applicant_id"`
		Approve     bool   `json:"approve"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Solicitud inválida", http.StatusBadRequest)
		return
	}

	applicantID, _ := uuid.Parse(body.ApplicantID)
	if err := h.uc.ResolveJoinRequest(commID, moderatorID, applicantID, body.Approve); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *CommunityHandler) getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	userStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		return uuid.Nil, http.ErrNoCookie // O un error genérico
	}
	return uuid.Parse(userStr)
}
