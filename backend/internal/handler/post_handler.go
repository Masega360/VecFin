package handler

import (
	"encoding/json"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/middleware"
	"github.com/google/uuid"
)

type PostUsecasePort interface {
	Create(communityID, authorID uuid.UUID, title, content, url string) error
	EditPost(communityID, authorID uuid.UUID, title, content, url string) error
	VotePost(postID uuid.UUID, isUpvote bool) error
	GetCommunityPosts(communityID, readerID uuid.UUID) ([]domain.Post, error)
	DeletePost(postID, userID uuid.UUID) error
	SearchPostsInCommunity(communityID, readerID uuid.UUID, query string) ([]domain.Post, error)
}

func (h *PostHandler) RegisterRoutes(jwtSecret string) {
	auth := middleware.RequireAuth(jwtSecret)

	http.HandleFunc("POST /posts", auth(h.Create))
	http.HandleFunc("PUT /posts/{id}", auth(h.Edit))
	http.HandleFunc("POST /posts/{id}/vote", auth(h.Vote))
	http.HandleFunc("DELETE /posts/{id}", auth(h.Delete))

	http.HandleFunc("GET /communities/{id}/posts", auth(h.GetCommunityPosts))
	http.HandleFunc("GET /communities/{id}/posts/search", auth(h.SearchPosts))

}

type PostHandler struct {
	uc PostUsecasePort
}

func NewPostHandler(uc PostUsecasePort) *PostHandler {
	return &PostHandler{uc: uc}
}

func (h *PostHandler) Create(w http.ResponseWriter, r *http.Request) {
	// 1. Obtener AuthorID del context (JWT)
	userStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}
	authorID, _ := uuid.Parse(userStr)

	// 2. Decodificar Body
	var body struct {
		CommunityID string `json:"community_id"`
		Title       string `json:"title"`
		Content     string `json:"content"`
		URL         string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Payload inválido", http.StatusBadRequest)
		return
	}

	commID, err := uuid.Parse(body.CommunityID)
	if err != nil {
		http.Error(w, "ID de comunidad inválido", http.StatusBadRequest)
		return
	}

	// 3. Llamar al caso de uso
	if err := h.uc.Create(commID, authorID, body.Title, body.Content, body.URL); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

// 2. El endpoint para EDITAR un post
func (h *PostHandler) Edit(w http.ResponseWriter, r *http.Request) {
	// A. Leer la orden (ID del post de la URL)
	postIDStr := r.PathValue("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		http.Error(w, "ID de post inválido", http.StatusBadRequest)
		return
	}

	// B. Saber quién es el cliente (ID del usuario del token)
	userStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}
	authorID, _ := uuid.Parse(userStr)

	// C. Leer qué quiere cambiar (Body JSON)
	var body struct {
		Title   string `json:"title"`
		Content string `json:"content"`
		Url     string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	// D. Mandar la orden al Chef (USECASE)
	// ¡El Caso de Uso decidirá si este autor es el dueño real del post!
	if err := h.uc.EditPost(postID, authorID, body.Title, body.Content, body.Url); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// 3. El endpoint para VOTAR un post
func (h *PostHandler) Vote(w http.ResponseWriter, r *http.Request) {
	postIDStr := r.PathValue("id")
	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		http.Error(w, "ID de post inválido", http.StatusBadRequest)
		return
	}

	var body struct {
		IsUpvote bool `json:"is_upvote"` // true = like, false = dislike
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "solicitud inválida", http.StatusBadRequest)
		return
	}

	// Mandar al Chef
	if err := h.uc.VotePost(postID, body.IsUpvote); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *PostHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID, _ := h.getUserIDFromContext(r) // Asegúrate de copiar la función auxiliar getUserIDFromContext aquí también

	postID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "ID inválido", http.StatusBadRequest)
		return
	}

	if err := h.uc.DeletePost(postID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusNoContent) // 204: Borrado exitoso
}

// Endpoint para OBTENER LOS POSTS de una comunidad
func (h *PostHandler) GetCommunityPosts(w http.ResponseWriter, r *http.Request) {
	// 1. Saber quién es el cliente (ID del lector)
	userStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		http.Error(w, "No autorizado", http.StatusUnauthorized)
		return
	}
	readerID, _ := uuid.Parse(userStr)

	// 2. Leer la orden de la URL (ID de la comunidad)
	commIDStr := r.PathValue("id")
	communityID, err := uuid.Parse(commIDStr)
	if err != nil {
		http.Error(w, "ID de comunidad inválido", http.StatusBadRequest)
		return
	}

	// 3. Pasar la orden al Chef (Usecase)
	posts, err := h.uc.GetCommunityPosts(communityID, readerID)
	if err != nil {
		// Si la comunidad es privada y no es miembro, el Usecase tirará error y caeremos aquí
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	// 4. Entregar el plato: Traducir los posts de Go a JSON y enviarlos
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func (h *PostHandler) SearchPosts(w http.ResponseWriter, r *http.Request) {
	readerID, _ := h.getUserIDFromContext(r)
	commID, _ := uuid.Parse(r.PathValue("id"))

	// Leemos el query parameter (ej: /posts/search?q=bitcoin)
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Falta el término de búsqueda (q)", http.StatusBadRequest)
		return
	}

	posts, err := h.uc.SearchPostsInCommunity(commID, readerID, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func (h *PostHandler) getUserIDFromContext(r *http.Request) (uuid.UUID, error) {
	userStr, ok := r.Context().Value(middleware.UserIDKey).(string)
	if !ok {
		return uuid.Nil, http.ErrNoCookie // O un error genérico
	}
	return uuid.Parse(userStr)
}
