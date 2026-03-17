type PostgresUserRepository struct {
	Create  func(user *User) error
	GetByID func(id string) (*User, error)
	Update  func(user *User) error
	Delete  func(user *User) error
}