package backend.internal.domain

import (
	
)

type User struct {
	id UUID
	first_name string
	last_name string
	email string
	password_hash string
	risk_profile riskType
	registration_date timestamp
	last_access timestamp
}
