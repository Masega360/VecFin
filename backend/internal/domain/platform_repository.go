package domain

type PlatformRepository interface {
	GetAll() ([]Platform, error)
	Search(query string) ([]Platform, error)
	GetByID(id string) (*Platform, error)
}
