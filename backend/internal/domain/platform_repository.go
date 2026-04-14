package domain

type PlatformRepository interface {
	Search(query string) ([]Platform, error)
	GetByID(id string) (*Platform, error)
}
