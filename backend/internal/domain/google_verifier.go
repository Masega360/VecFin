package domain

// GoogleUserInfo contiene los datos del usuario devueltos por Google.
type GoogleUserInfo struct {
	Sub        string
	Email      string
	GivenName  string
	FamilyName string
}

// GoogleVerifier es el puerto que abstrae la verificación de tokens de Google.
// El usecase depende de esta interfaz, no de la implementación HTTP.
type GoogleVerifier interface {
	Verify(idToken string) (*GoogleUserInfo, error)
}
