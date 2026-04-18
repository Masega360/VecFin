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

func (p *PostUsecase) Create(communityID, authorID uuid.UUID, title, content, url string) error {
	if title == "" || content == "" {
		return errors.New("El post tiene que tener un titulo o contenido")
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

func (p *PostUsecase) VotePost(postID uuid.UUID, isUpvote bool) error {
	post, err := p.postRepo.FindByID(postID)
	if err != nil {
		return err
	}

	if isUpvote {
		post.Upvote()
	} else {
		post.Downvote()
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

func (p *PostUsecase) GetCommunityPosts(communityID, readerID uuid.UUID) ([]domain.Post, error) {
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

	// Si es pública, o si es privada pero SI es miembro, puede ver los posts
	return p.postRepo.FindByCommunityID(communityID)
}

func (p *PostUsecase) SearchPostsInCommunity(communityID, readerID uuid.UUID, query string) ([]domain.Post, error) {
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
