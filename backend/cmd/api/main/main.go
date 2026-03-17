package main

import (
	"database/sql"
	"log"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	"github.com/Masega360/vecfin/config"
	"github.com/Masega360/vecfin/internal/handler"
	"github.com/Masega360/vecfin/internal/repository"
	"github.com/Masega360/vecfin/internal/usecase"
)

func main() {
	// cargar .env
	if err := godotenv.Load(); err != nil {
		log.Fatal("Error cargando .env")
	}

	// config
	cfg := config.Load()

	// conectar DB
	dsn := "host=" + cfg.DBHost +
		" port=" + cfg.DBPort +
		" user=" + cfg.DBUser +
		" password=" + cfg.DBPassword +
		" dbname=" + cfg.DBName +
		" sslmode=disable"

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("Error conectando a la DB:", err)
	}
	defer db.Close()

	// verificar conexión
	if err := db.Ping(); err != nil {
		log.Fatal("No se pudo conectar a la DB:", err)
	}
	log.Println("Conectado a la DB")

	// inyección de dependencias
	repo := repository.NewPostgresUserRepository(db)
	uc := usecase.NewUserUsecase(repo)
	h := handler.NewUserHandler(uc)

	// rutas
	h.RegisterRoutes()

	log.Println("Servidor corriendo en puerto", cfg.Port)
}
