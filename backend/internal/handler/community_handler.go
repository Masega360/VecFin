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
	LeaveCommunity(communityID, userID uuid.UUID) error
	KickMember(communityID, initiatorID, targetID uuid.UUID) error
	PromoteToOwner(communityID, currentOwnerID, newOwnerID uuid.UUID) error
	ResolveJoinRequest(communityID, moderatorID, applicantID uuid.UUID, approve bool) error
	GetUserCommunities(userID uuid.UUID) ([]domain.Community, error)
	DeleteCommunity(communityID, userID uuid.UUID) error
	SearchCommunities(query string) ([]domain.Community, error)
	GetCommunity(communityID uuid.UUID) (domain.Community, error) // Para ver el perfil de la comunidad
	UpdateCommunity(communityID, userID uuid.UUID, name, desc, rules, logo string) error
	GetMemberRole(communityID, userID uuid.UUID) (string, error)
	GetMembers(communityID, requesterID uuid.UUID) ([]domain.CommunityMemberResponse, error)
	GetPendingRequests(communityID, moderatorID uuid.UUID) ([]domain.JoinRequest, error)
	DemoteModerator(communityID, ownerID, targetID uuid.UUID) error
	TransferOwnership(commID, userID, targetID uuid.UUID) error
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
	http.HandleFunc("GET /communities/me", auth(h.GetMyCommunities))
	http.HandleFunc("DELETE /communities/{id}", auth(h.Delete))
	http.HandleFunc("POST /communities/{id}/join", auth(h.Join))
	http.HandleFunc("POST /communities/{id}/kick", auth(h.Kick))
	http.HandleFunc("POST /communities/{id}/promote", auth(h.Promote))
	http.HandleFunc("POST /communities/{id}/requests/resolve", auth(h.ResolveRequest))
	http.HandleFunc("POST /communities/{id}/leave", auth(h.Leave))
	http.HandleFunc("PUT /communities/{id}", auth(h.Update))
	http.HandleFunc("GET /communities/{id}/role", auth(h.GetRole))
	http.HandleFunc("GET /communities/{id}/members", auth(h.GetMembers))
	http.HandleFunc("GET /communities/{id}/requests", auth(h.GetPendingRequests))
	http.HandleFunc("POST /communities/{id}/demote", auth(h.Demote))
	http.HandleFunc("POST /communities/{id}/transfer", auth(h.Transfer))

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

func (h *CommunityHandler) GetMyCommunities(w http.ResponseWriter, r *http.Request) {
	userID, err := h.getUserIDFromContext(r)
	if err != nil {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}

	communities, err := h.uc.GetUserCommunities(userID)
	if err != nil {
		http.Error(w, "Error al obtener las comunidades", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(communities); err != nil {
		http.Error(w, "Error al codificar la respuesta", http.StatusInternalServerError)
	}
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

func (h *CommunityHandler) Leave(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))

	if err := h.uc.LeaveCommunity(commID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *CommunityHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))

	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Rules       string `json:"rules"`
		LogoUrl     string `json:"logo_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.UpdateCommunity(commID, userID, body.Name, body.Description, body.Rules, body.LogoUrl); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *CommunityHandler) GetRole(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))

	role, err := h.uc.GetMemberRole(commID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	// Devolvemos un JSON simple: {"role": "owner"}
	json.NewEncoder(w).Encode(map[string]string{"role": role})
}

func (h *CommunityHandler) GetMembers(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))
	members, err := h.uc.GetMembers(commID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

func (h *CommunityHandler) GetPendingRequests(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))
	reqs, err := h.uc.GetPendingRequests(commID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reqs)
}

func (h *CommunityHandler) Demote(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))
	var body struct {
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Solicitud inválida", http.StatusBadRequest)
		return
	}
	targetID, _ := uuid.Parse(body.TargetID)
	if err := h.uc.DemoteModerator(commID, userID, targetID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *CommunityHandler) Transfer(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))
	var body struct {
		TargetID string `json:"target_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Solicitud inválida", http.StatusBadRequest)
		return
	}
	targetID, _ := uuid.Parse(body.TargetID)
	if err := h.uc.TransferOwnership(commID, userID, targetID); err != nil {
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
