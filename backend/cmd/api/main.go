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

	"github.com/Masega360/vecfin/backend/config"
	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/googleauth"
	"github.com/Masega360/vecfin/backend/internal/handler"
	"github.com/Masega360/vecfin/backend/internal/platform/binance"
	"github.com/Masega360/vecfin/backend/internal/platform/gemini"
	"github.com/Masega360/vecfin/backend/internal/platform/yahoo"
	"github.com/Masega360/vecfin/backend/internal/repository"
	"github.com/Masega360/vecfin/backend/internal/usecase"
	"github.com/rs/cors"
)

func main() {
	// En Docker las vars vienen del compose; godotenv solo aplica en desarrollo local
	if err := godotenv.Load(); err != nil {
		log.Println("Aviso: no se encontró .env, usando variables de entorno del sistema")
	}

	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatal("Configuración inválida:", err)
	}

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
	runMigrations(db, cfg.MigrationsPath)
	// --------------------------------------

	userRepo := repository.NewPostgresUserRepository(db)

	userUC := usecase.NewUserUsecase(userRepo)
	userHandler := handler.NewUserHandler(userUC)
	userHandler.RegisterRoutes(cfg.JWTSecret)

	googleVerifier := googleauth.NewHTTPGoogleVerifier()
	authUC := usecase.NewAuthUsecase(userRepo, cfg.JWTSecret, googleVerifier)
	authHandler := handler.NewAuthHandler(authUC)
	authHandler.RegisterRoutes()

	yahooClient := yahoo.NewClient()
	binanceMarket := binance.NewClient()
	assetRepo := repository.NewPostgresAssetRepository(db)
	marketUC := usecase.NewMarketUsecase(assetRepo, yahooClient, binanceMarket)
	marketHandler := handler.NewMarketHandler(marketUC)
	marketHandler.RegisterRoutes(cfg.JWTSecret)

	walletRepo := repository.NewPostgresWalletRepository(db)
	assetWalletRepo := repository.NewPostgresAssetWalletRepository(db)
	platformRepo := repository.NewPostgresPlatformRepository(db)
	exchanges := map[string]domain.ExchangeService{
		"binance": binance.NewClient(),
	}
	walletUC := usecase.NewWalletsUseCase(walletRepo, assetWalletRepo, marketUC, platformRepo, exchanges)
	walletHandler := handler.NewWalletHandler(walletUC)
	walletHandler.RegisterRoutes(cfg.JWTSecret)

	platformUC := usecase.NewPlatformUsecase(platformRepo)
	supportedExchanges := make(map[string]bool, len(exchanges))
	for name := range exchanges {
		supportedExchanges[name] = true
	}
	platformHandler := handler.NewPlatformHandler(platformUC, supportedExchanges)
	platformHandler.RegisterRoutes(cfg.JWTSecret)

	commRepo := repository.NewPostgresCommunityRepository(db)
	commUC := usecase.NewCommunityUsecase(commRepo)
	commHandler := handler.NewCommunityHandler(commUC)
	commHandler.RegisterRoutes(cfg.JWTSecret)

	postRepo := repository.NewPostgresPostRepository(db)
	postUC := usecase.NewPostUsecase(postRepo, commRepo)
	postHandler := handler.NewPostHandler(postUC)
	postHandler.RegisterRoutes(cfg.JWTSecret)

	if cfg.GeminiAPIKey != "" {
		geminiClient, err := gemini.NewClient(cfg.GeminiAPIKey)
		if err != nil {
			log.Fatal("Error inicializando Gemini:", err)
		}
		recCacheRepo := repository.NewPostgresRecommendationRepository(db)
		recUC := usecase.NewRecommendationUsecase(geminiClient, userRepo, walletRepo, assetWalletRepo, recCacheRepo)
		recHandler := handler.NewRecommendationHandler(recUC)
		recHandler.RegisterRoutes(cfg.JWTSecret)

		chatRepo := repository.NewPostgresChatRepository(db)
		chatUC := usecase.NewChatUsecase(chatRepo, geminiClient)
		chatHandler := handler.NewChatHandler(chatUC)
		chatHandler.RegisterRoutes(cfg.JWTSecret)
	} else {
		log.Println("Aviso: GEMINI_API_KEY no configurada, endpoints de IA deshabilitados")
	}

	http.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if _, err := w.Write([]byte(`{"status":"ok"}`)); err != nil {
			log.Println("Error escribiendo respuesta de health:", err)
		}
	})

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
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
func runMigrations(db *sql.DB, migrationsPath string) {
	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		log.Fatal("Error instanciando driver de migración:", err)
	}

	// Apunta a la carpeta local de migraciones
	m, err := migrate.NewWithDatabaseInstance(
		migrationsPath,
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
