package main

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"

	// Imports para las migraciones automáticas
	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"github.com/Masega360/vecfin/backend/config"
	"github.com/Masega360/vecfin/backend/internal/domain"
	"github.com/Masega360/vecfin/backend/internal/googleauth"
	"github.com/Masega360/vecfin/backend/internal/handler"
	"github.com/Masega360/vecfin/backend/internal/infrastructure"
	"github.com/Masega360/vecfin/backend/internal/platform/aiprovider"
	"github.com/Masega360/vecfin/backend/internal/platform/bedrock"
	"github.com/Masega360/vecfin/backend/internal/platform/binance"
	"github.com/Masega360/vecfin/backend/internal/platform/gemini"
	"github.com/Masega360/vecfin/backend/internal/platform/news"
	"github.com/Masega360/vecfin/backend/internal/platform/pdf"
	"github.com/Masega360/vecfin/backend/internal/platform/cache"
	"github.com/Masega360/vecfin/backend/internal/platform/yahoo"
	"github.com/Masega360/vecfin/backend/internal/repository"
	"github.com/Masega360/vecfin/backend/internal/usecase"
	"github.com/Masega360/vecfin/backend/internal/worker"
	"github.com/rs/cors"
)

func main() {
	CRON := 1 * time.Minute

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

	settingsRepo := repository.NewPostgresNotificationSettingsRepository(db)
	priceAlertRepo := repository.NewPostgresPriceAlertRepository(db)

	settingsUC := usecase.NewNotificationSettingUsecase(settingsRepo)
	settingsHandler := handler.NewNotificationSettingHandler(settingsUC)
	settingsHandler.RegisterRoutes(cfg.JWTSecret)

	smtpConf := infrastructure.SMTPConfig{
		SMTPServer: cfg.SMTPServer,
		Port:       cfg.SMTPPort,
		Sender:     cfg.SMTPSender,
		Password:   cfg.SMTPPassword,
	}
	emailProvider := infrastructure.NewEmailService(userRepo, smtpConf)

	dispatcher := usecase.NewNotificationDispatcher(settingsRepo)
	dispatcher.RegisterProvider(domain.ChannelEmail, emailProvider)

	followRepo := repository.NewPostgresFollowRepository(db)
	followUC := usecase.NewFollowUseCase(followRepo, userRepo, dispatcher)
	followHandler := handler.NewFollowHandler(followUC)
	followHandler.RegisterRoutes(cfg.JWTSecret)

	googleVerifier := googleauth.NewHTTPGoogleVerifier()
	authUC := usecase.NewAuthUsecase(userRepo, cfg.JWTSecret, googleVerifier)
	authHandler := handler.NewAuthHandler(authUC)
	authHandler.RegisterRoutes()

	yahooClient := cache.NewMarketCache(yahoo.NewClient(), 2*time.Minute)
	binanceMarket := binance.NewClient()
	assetRepo := repository.NewPostgresAssetRepository(db)
	marketUC := usecase.NewMarketUsecase(assetRepo, yahooClient, binanceMarket)
	marketHandler := handler.NewMarketHandler(marketUC)
	marketHandler.RegisterRoutes(cfg.JWTSecret)

	assetCommentRepo := repository.NewPostgresAssetCommentRepository(db)
	assetCommentHandler := handler.NewAssetCommentHandler(assetCommentRepo)
	assetCommentHandler.RegisterRoutes(cfg.JWTSecret)

	walletRepo := repository.NewPostgresWalletRepository(db)
	assetWalletRepo := repository.NewPostgresAssetWalletRepository(db)
	platformRepo := repository.NewPostgresPlatformRepository(db)
	walletMemberRepo := repository.NewPostgresWalletMemberRepository(db)
	transferRepo := repository.NewPostgresTransferRepository(db)
	exchanges := map[string]domain.ExchangeService{
		"binance": binance.NewClient(),
	}
	walletUC := usecase.NewWalletsUseCase(walletRepo, assetWalletRepo, marketUC, platformRepo, exchanges, followUC, walletMemberRepo, transferRepo)
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
	commUC := usecase.NewCommunityUsecase(commRepo, userRepo, followUC, dispatcher)
	commHandler := handler.NewCommunityHandler(commUC)
	commHandler.RegisterRoutes(cfg.JWTSecret)

	postRepo := repository.NewPostgresPostRepository(db)
	postUC := usecase.NewPostUsecase(postRepo, commRepo, userRepo, followUC, dispatcher)
	postHandler := handler.NewPostHandler(postUC)
	postHandler.RegisterRoutes(cfg.JWTSecret)

	simulatorRepo := repository.NewPostgresSimulatorRepository(db)
	simulatorUC := usecase.NewSimulatorUsecase(simulatorRepo)
	simulatorHandler := handler.NewSimulatorHandler(simulatorUC)
	simulatorHandler.RegisterRoutes(cfg.JWTSecret)

	priceAlertUC := usecase.NewPriceAlertUsecase(priceAlertRepo)
	priceAlertHandler := handler.NewPriceAlertHandler(priceAlertUC)
	priceAlertHandler.RegisterRoutes(cfg.JWTSecret)

	dashboardUC := usecase.NewDashboardUsecase(walletRepo, assetWalletRepo, priceAlertRepo, marketUC)
	dashboardHandler := handler.NewDashboardHandler(dashboardUC)
	dashboardHandler.RegisterRoutes(cfg.JWTSecret)

	pdfGen := pdf.NewFPDFGenerator()
	tokenRepo := repository.NewPostgresTokenUsageRepository(db)
	fiscalUC := usecase.NewFiscalReportUsecase(userRepo, walletRepo, assetWalletRepo, marketUC, pdfGen, tokenRepo)
	fiscalHandler := handler.NewFiscalReportHandler(fiscalUC)
	fiscalHandler.RegisterRoutes(cfg.JWTSecret)

	alertWorker := worker.NewPriceAlertWorker(priceAlertRepo, yahooClient, dispatcher)

	// Inicia el worker para que consulte precios, por ejemplo, cada 5 minutos.
	// Esto corre en una goroutine y no bloquea el servidor HTTP.
	alertWorker.Start(CRON)

	// News siempre disponible
	newsSvc := news.NewService(news.NewClient(""))
	newsHandler := handler.NewNewsHandler(newsSvc)
	newsHandler.RegisterRoutes(cfg.JWTSecret)

	// AI Provider: Gemini primary + Bedrock fallback, o solo Bedrock, o solo Gemini
	var aiProvider domain.AIProvider
	if cfg.GeminiAPIKey != "" {
		geminiClient, err := gemini.NewClient(cfg.GeminiAPIKey)
		if err != nil {
			log.Println("Aviso: Gemini no disponible:", err)
		} else {
			aiProvider = geminiClient
		}
	}

	bedrockClient, err := bedrock.NewClient(context.Background(), cfg.AWSRegion)
	if err != nil {
		log.Printf("Aviso: Bedrock no disponible (%v)", err)
	} else if aiProvider != nil {
		aiProvider = &aiprovider.Fallback{Primary: aiProvider, Secondary: bedrockClient}
		log.Println("AI: Gemini (primary) + Bedrock (fallback)")
	} else {
		aiProvider = bedrockClient
		log.Println("AI: Bedrock only")
	}

	if aiProvider != nil {
		recCacheRepo := repository.NewPostgresRecommendationRepository(db)
		chatRepo := repository.NewPostgresChatRepository(db)

		recUC := usecase.NewRecommendationUsecase(aiProvider, userRepo, walletRepo, assetWalletRepo, recCacheRepo, newsSvc, assetRepo, chatRepo)
		recHandler := handler.NewRecommendationHandler(recUC)
		recHandler.RegisterRoutes(cfg.JWTSecret)

		chatUC := usecase.NewChatUsecase(chatRepo, aiProvider, userRepo, walletMemberRepo, assetWalletRepo, marketUC, newsSvc, tokenRepo)
		chatHandler := handler.NewChatHandler(chatUC)
		chatHandler.RegisterRoutes(cfg.JWTSecret)
	} else {
		log.Println("Aviso: ningún proveedor de IA disponible, endpoints de IA deshabilitados")
	}

	leaderboardHandler := handler.NewLeaderboardHandler(db)
	leaderboardHandler.RegisterRoutes(cfg.JWTSecret)

	marketplaceHandler := handler.NewMarketplaceHandler(db, yahooClient)
	marketplaceHandler.RegisterRoutes(cfg.JWTSecret)

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
