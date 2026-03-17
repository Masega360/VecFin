package domain

type Crud interface {
	Create(entity interface{}) error
	Read(id string) (entity interface{}, err error)
	Update(id string, entity interface{}) error
	Delete(id string) error
}
