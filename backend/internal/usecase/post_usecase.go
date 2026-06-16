package usecase

import (
	"errors"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/google/uuid"
)

// Definimos la interfaz local para el Dispatcher
type PostNotificationDispatcher interface {
	DispatchPostReply(authorID uuid.UUID, postTitle, replierName string)
	DispatchPostVote(authorID uuid.UUID, postTitle string, isUpvote bool)
}

type PostUsecase struct {
	postRepo      domain.PostRepository
	commRepo      domain.CommunityRepository
	userRepo      domain.UserRepository
	followUsecase ProfileVisibilityChecker
	dispatcher    PostNotificationDispatcher
}

func NewPostUsecase(
	postRepo domain.PostRepository,
	commRepo domain.CommunityRepository,
	userRepo domain.UserRepository,
	follow ProfileVisibilityChecker,
	dispatcher PostNotificationDispatcher,
) *PostUsecase {
	return &PostUsecase{
		postRepo:      postRepo,
		commRepo:      commRepo,
		userRepo:      userRepo,
		followUsecase: follow,
		dispatcher:    dispatcher,
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
	err := p.postRepo.Create(post)
	if err != nil {
		return err
	}

	if parentID != nil {
		parentPost, err := p.postRepo.FindByID(*parentID)

		// no se notifica a si mismo
		if err == nil && parentPost.AuthorID != authorID {
			replier, errUser := p.userRepo.FindByID(authorID)
			replierName := "Un usuario"
			if errUser == nil {
				replierName = replier.FirstName
			}

			p.dispatcher.DispatchPostReply(parentPost.AuthorID, parentPost.Title, replierName)
		}
	}

	return nil
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

	isSelfVote := post.AuthorID == userID
	shouldNotify := false

	existing, err := p.postRepo.FindVote(postID, userID)

	if err != nil {
		// No tenía voto previo → voto nuevo
		shouldNotify = true
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
		shouldNotify = false
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
		shouldNotify = true
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

	err = p.postRepo.Update(post)

	if err == nil && shouldNotify && !isSelfVote {
		p.dispatcher.DispatchPostVote(post.AuthorID, post.Title, isUpvote)
	}
	return err
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

func (p *PostUsecase) GetCommunityPosts(communityID, readerID uuid.UUID, limit, offset int) ([]domain.PostResponse, error) {
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

	return p.postRepo.FindByCommunityIDPaginated(communityID, readerID, limit, offset)
}

func (p *PostUsecase) SearchPostsInCommunity(communityID, readerID uuid.UUID, query string, limit, offset int) ([]domain.PostResponse, error) {
	comm, err := p.commRepo.FindByID(communityID)
	if err != nil {
		return nil, err
	}

	if comm.IsPrivate {
		if _, err := p.commRepo.FindMember(communityID, readerID); err != nil {
			return nil, errors.New("Esta comunidad es privada, no puedes buscar posts sin ser miembro")
		}
	}

	return p.postRepo.SearchPostsInCommunity(communityID, query, limit, offset)
}

func (p *PostUsecase) GetReplies(postID, readerID uuid.UUID) ([]domain.PostResponse, error) {
	return p.postRepo.FindRepliesByPostID(postID, readerID)
}

func (p *PostUsecase) ShowPosts(viewerID, targetID uuid.UUID, limit, offset int) ([]domain.PostResponse, error) {
	profileVis, err := p.followUsecase.GetProfileVisibility(viewerID, targetID)
	if err != nil {
		return nil, err
	}

	if !profileVis.CanSeePosts {
		return nil, errors.New("no tienes permisos para ver los posts de este usuario")
	}

	return p.postRepo.FindByAuthorID(targetID, viewerID, limit, offset)
}
