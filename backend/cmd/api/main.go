package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	// Imports nuevos para las migraciones automáticas
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"github.com/rs/cors"
	"github.com/Masega360/vecfin/backend/config"
	"github.com/Masega360/vecfin/backend/internal/handler"
	"github.com/Masega360/vecfin/backend/internal/repository"
	"github.com/Masega360/vecfin/backend/internal/usecase"
)

func main() {
	// En Docker las vars vienen del compose; godotenv solo aplica en desarrollo local
	godotenv.Load()

	cfg := config.Load()

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

	if err := db.Ping(); err != nil {
		log.Fatal("No se pudo conectar a la DB:", err)
	}
	log.Println("Conectado a la DB")

	// --- LÓGICA DE MIGRACIÓN AUTOMÁTICA ---
	runMigrations(db)
	// --------------------------------------

	userRepo := repository.NewPostgresUserRepository(db)

	userUC := usecase.NewUserUsecase(userRepo)
	userHandler := handler.NewUserHandler(userUC)
	userHandler.RegisterRoutes(cfg.JWTSecret)

	authUC := usecase.NewAuthUsecase(userRepo, cfg.JWTSecret)
	authHandler := handler.NewAuthHandler(authUC)
	authHandler.RegisterRoutes()

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: false,
	})

	// Envolvemos el Mux por defecto con el middleware de CORS y el de Logs
	handlerWithCORS := c.Handler(http.DefaultServeMux)

	handlerWithLogs := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Petición recibida: %s %s desde %s", r.Method, r.URL.Path, r.RemoteAddr)
		handlerWithCORS.ServeHTTP(w, r)
	})

	serverAddr := ":" + cfg.Port
	log.Printf("Servidor escuchando en %s", serverAddr)

	if err := http.ListenAndServe(serverAddr, handlerWithLogs); err != nil {
		log.Fatal("Error al iniciar el servidor:", err)
	}
}

// runMigrations lee los archivos .sql y actualiza la base de datos
func runMigrations(db *sql.DB) {
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		log.Fatal("Error instanciando driver de migración:", err)
	}

	// Apunta a la carpeta local de migraciones
	m, err := migrate.NewWithDatabaseInstance(
		"file://migrations",
		"postgres",
		driver,
	)
	if err != nil {
		log.Fatal("Error creando instancia de migración:", err)
	}

	err = m.Up()
	if err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatal("Error ejecutando migraciones:", err)
	}

	log.Println("Migraciones verificadas/aplicadas exitosamente.")
}
