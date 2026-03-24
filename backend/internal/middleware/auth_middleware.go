package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "user_id"

// RequireAuth es un middleware que verifica que el request traiga un JWT válido
func RequireAuth(secret string) func(http.HandlerFunc) http.HandlerFunc {
	return func(next http.HandlerFunc) http.HandlerFunc {
		return func(w http.ResponseWriter, r *http.Request) {
			// 1. Extraer el header Authorization
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "No autorizado: falta el token", http.StatusUnauthorized)
				return
			}

			// 2. Limpiar el string para quedarnos solo con el token
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")

			// 3. Parsear y validar el token con nuestro secreto
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				http.Error(w, "No autorizado: token inválido o expirado", http.StatusUnauthorized)
				return
			}

			// 4. Extraer el ID del usuario de los claims y guardarlo en el contexto
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				// Guardamos el "user_id" en el contexto del request para que el handler sepa quién es
				ctx := context.WithValue(r.Context(), UserIDKey, claims["user_id"])

				// Le pasamos el control al handler original (ej. h.Update)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			http.Error(w, "No autorizado: error en los claims", http.StatusUnauthorized)
		}
	}
}
