package config

import (
	"errors"
	"os"
)

type Config struct {
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	Port           string
	JWTSecret      string
	MigrationsPath string
	GeminiAPIKey   string
}

func Load() *Config {
	return &Config{
		DBHost:         os.Getenv("DB_HOST"),
		DBPort:         os.Getenv("DB_PORT"),
		DBUser:         os.Getenv("DB_USER"),
		DBPassword:     os.Getenv("DB_PASSWORD"),
		DBName:         os.Getenv("DB_NAME"),
		Port:           os.Getenv("PORT"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		MigrationsPath: getEnvOrDefault("MIGRATIONS_PATH", "file://migrations"),
		GeminiAPIKey:   os.Getenv("GEMINI_API_KEY"),
	}
}

func (c *Config) Validate() error {
	if c.JWTSecret == "" {
		return errors.New("JWT_SECRET no puede estar vacío")
	}
	if len(c.JWTSecret) < 32 {
		return errors.New("JWT_SECRET debe tener al menos 32 caracteres")
	}
	if c.Port == "" {
		return errors.New("PORT no puede estar vacío")
	}
	return nil
}

func getEnvOrDefault(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}
