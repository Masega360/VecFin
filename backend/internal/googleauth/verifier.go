package googleauth

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

// HTTPGoogleVerifier implementa domain.GoogleVerifier usando la API de Google.
type HTTPGoogleVerifier struct{}

func NewHTTPGoogleVerifier() *HTTPGoogleVerifier {
	return &HTTPGoogleVerifier{}
}

func (v *HTTPGoogleVerifier) Verify(idToken string) (*domain.GoogleUserInfo, error) {
	resp, err := http.Get(fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", idToken))
	if err != nil {
		return nil, errors.New("error al verificar token de Google")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("token de Google inválido")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, errors.New("error al leer respuesta de Google")
	}

	var raw struct {
		Sub        string `json:"sub"`
		Email      string `json:"email"`
		GivenName  string `json:"given_name"`
		FamilyName string `json:"family_name"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, errors.New("error al parsear respuesta de Google")
	}

	if raw.Sub == "" {
		return nil, errors.New("token de Google inválido")
	}

	return &domain.GoogleUserInfo{
		Sub:        raw.Sub,
		Email:      raw.Email,
		GivenName:  raw.GivenName,
		FamilyName: raw.FamilyName,
	}, nil
}
