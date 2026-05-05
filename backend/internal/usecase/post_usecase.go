package usecase

import (
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

type PostUsecase struct {
	postRepo domain.PostRepository
	commRepo domain.CommunityRepository
}

func NewPostUsecase(postRepo domain.PostRepository, commRepo domain.CommunityRepository) *PostUsecase {
	return &PostUsecase{
		postRepo: postRepo,
		commRepo: commRepo,
	}
}

func (p *PostUsecase) Create(communityID, authorID uuid.UUID, parentID *uuid.UUID, title, content, url string) error {
	if parentID == nil && (title == "" || content == "") {
		return errors.New("El post tiene que tener un titulo y contenido")
	}
	if content == "" {
		return errors.New("El comentario no puede estar vacío")
	}
	if len(title) > 32 {
		return errors.New("El titulo no puede superar los 32 caracteres")
	}
	if len(content) > 1024 {
		return errors.New("El contenido no puede superar los 1024 caracteres")
	}

	post := domain.Post{
		ID:           uuid.New(),
		CommunityID:  communityID,
		ParentID:     parentID,
		AuthorID:     authorID,
		Title:        title,
		Content:      content,
		URL:          url,
		Upvotes:      0,
		Downvotes:    0,
		CommentCount: 0,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	return p.postRepo.Create(post)
}

func (p *PostUsecase) EditPost(postID, authorID uuid.UUID, title, content, url string) error {
	post, err := p.postRepo.FindByID(postID)
	if err != nil {
		return err
	}

	if post.AuthorID != authorID {
		return errors.New("No tienes permiso para editar este post")
	}

	if err := post.Edit(title, content, url); err != nil {
		return err
	}

	return p.postRepo.Update(post)
}

func (p *PostUsecase) VotePost(postID, userID uuid.UUID, isUpvote bool) error {
	post, err := p.postRepo.FindByID(postID)
	if err != nil {
		return err
	}

	existing, err := p.postRepo.FindVote(postID, userID)

	if err != nil {
		// No tenía voto previo → voto nuevo
		if isUpvote {
			post.Upvotes++
		} else {
			post.Downvotes++
		}
		if err := p.postRepo.UpsertVote(domain.PostVote{PostID: postID, UserID: userID, IsUpvote: isUpvote}); err != nil {
			return err
		}
	} else if existing.IsUpvote == isUpvote {
		// Toggle: mismo voto → quitar
		if isUpvote {
			post.Upvotes--
		} else {
			post.Downvotes--
		}
		if err := p.postRepo.DeleteVote(postID, userID); err != nil {
			return err
		}
	} else {
		// Cambio de voto: up→down o down→up
		if isUpvote {
			post.Upvotes++
			post.Downvotes--
		} else {
			post.Downvotes++
			post.Upvotes--
		}
		if err := p.postRepo.UpsertVote(domain.PostVote{PostID: postID, UserID: userID, IsUpvote: isUpvote}); err != nil {
			return err
		}
	}

	// Asegurar que no queden negativos
	if post.Upvotes < 0 {
		post.Upvotes = 0
	}
	if post.Downvotes < 0 {
		post.Downvotes = 0
	}

	return p.postRepo.Update(post)
}

func (p *PostUsecase) DeletePost(postID, userID uuid.UUID) error {
	post, err := p.postRepo.FindByID(postID)
	if err != nil {
		return err
	}

	//Es el autor original
	if post.AuthorID == userID {
		return p.postRepo.Delete(postID)
	}

	// No es el autor. busco si es Moderador/Owner en la comunidad
	member, err := p.commRepo.FindMember(post.CommunityID, userID)
	if err != nil {
		return errors.New("No tienes permisos para borrar este post")
	}

	if !member.CanDeletePost() {
		return errors.New("No eres el autor ni tienes rango de moderador para borrar esto")
	}

	return p.postRepo.Delete(postID)
}

func (p *PostUsecase) GetCommunityPosts(communityID, readerID uuid.UUID) ([]domain.PostResponse, error) {
	comm, err := p.commRepo.FindByID(communityID)
	if err != nil {
		return nil, err
	}

	// Si es privada, verificamos si el lector es miembro
	if comm.IsPrivate == true {
		_, err := p.commRepo.FindMember(communityID, readerID)
		if err != nil {
			return nil, errors.New("Esta comunidad es privada, debes ser miembro para ver los posts")
		}
	}

	return p.postRepo.FindByCommunityID(communityID, readerID)
}

func (p *PostUsecase) SearchPostsInCommunity(communityID, readerID uuid.UUID, query string) ([]domain.PostResponse, error) {
	comm, err := p.commRepo.FindByID(communityID)
	if err != nil {
		return nil, err
	}

	if comm.IsPrivate {
		if _, err := p.commRepo.FindMember(communityID, readerID); err != nil {
			return nil, errors.New("Esta comunidad es privada, no puedes buscar posts sin ser miembro")
		}
	}

	return p.postRepo.SearchPostsInCommunity(communityID, query)
}

func (p *PostUsecase) GetReplies(postID, readerID uuid.UUID) ([]domain.PostResponse, error) {
	return p.postRepo.FindRepliesByPostID(postID, readerID)
}
