package domain

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

type Post struct {
	ID          uuid.UUID  `json:"id"`
	CommunityID uuid.UUID  `json:"community_id"`
	ParentID    *uuid.UUID `json:"parent_id,omitempty"` // Nil = Post, UUID = Comentario
	AuthorID    uuid.UUID  `json:"author_id"`

	Title   string `json:"title,omitempty"`
	Content string `json:"content"`
	URL     string `json:"url,omitempty"`

	Upvotes      int `json:"upvotes"`
	Downvotes    int `json:"downvotes"`
	CommentCount int `json:"comment_count"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PostRepository interface {
	Create(post Post) error
	FindByID(id uuid.UUID) (Post, error)
	FindByCommunityID(communityID, readerID uuid.UUID) ([]PostResponse, error)
	FindRepliesByPostID(parentID, readerID uuid.UUID) ([]PostResponse, error)
	SearchPostsInCommunity(communityID uuid.UUID, query string) ([]PostResponse, error)
	Update(post Post) error
	Delete(id uuid.UUID) error

	FindVote(postID, userID uuid.UUID) (PostVote, error)
	UpsertVote(vote PostVote) error
	DeleteVote(postID, userID uuid.UUID) error
}

func (p *Post) Edit(title, content, url string) error {
	if content == "" {
		return errors.New("El contenido no puede estar vacío")
	}
	p.Title = title
	p.Content = content
	p.URL = url
	p.UpdatedAt = time.Now()
	return nil
}
func (p *Post) Upvote() {
	p.Upvotes++
}

func (p *Post) Downvote() {
	p.Downvotes++
}

func (p *Post) IncrementCommentCount() {
	p.CommentCount++
}

type PostResponse struct {
	Post
	AuthorName string `json:"author_name"`
	UserVote   *bool  `json:"user_vote"` // nil = sin voto, true = upvote, false = downvote
}

type PostVote struct {
	PostID   uuid.UUID
	UserID   uuid.UUID
	IsUpvote bool
}
