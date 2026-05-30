package worker

import (
	"fmt"
	"time"

	"github.com/Masega360/vecfin/backend/internal/domain"
)

// Interfaz para conectarse a Yahoo Finance (lo tenés que implementar)
type FinanceClient interface {
	GetCurrentPrice(symbol string) (float64, error)
}

// Interfaz del Dispatcher que hicimos antes
type DispatcherPort interface {
	DispatchPriceAlert(alert domain.PriceAlert, currentPrice float64) error
}

type PriceAlertWorker struct {
	alertRepo     domain.PriceAlertRepository
	financeClient FinanceClient
	dispatcher    DispatcherPort
}

func NewPriceAlertWorker(r domain.PriceAlertRepository, fc FinanceClient, d DispatcherPort) *PriceAlertWorker {
	return &PriceAlertWorker{
		alertRepo:     r,
		financeClient: fc,
		dispatcher:    d,
	}
}

// Start levanta el proceso en segundo plano.
// Recibe cada cuánto querés revisar los precios (ej: 5 minutos)
func (w *PriceAlertWorker) Start(interval time.Duration) {
	ticker := time.NewTicker(interval)

	// La palabra 'go' crea un hilo en segundo plano que no bloquea tu servidor
	go func() {
		fmt.Println("🚀 Worker de Alertas de Precio iniciado...")

		// Hacemos una primera revisión apenas arranca el server
		w.checkPrices()

		// Este loop infinito se queda esperando a que el 'ticker' suene
		for range ticker.C {
			w.checkPrices()
		}
	}()
}

func (w *PriceAlertWorker) checkPrices() {
	// 1. Acá buscaríamos en la DB qué símbolos activos tenemos.
	// Por ahora, lo harcodeamos para la explicación:
	symbolsToCheck, err := w.alertRepo.GetSymbolsByDistinctActiveAlerts()
	if err != nil {
		fmt.Printf("Error obteniendo símbolos activos de la DB: %v\n", err)
		return
	}
	if len(symbolsToCheck) == 0 {
		fmt.Printf("No hay qué notificar: %v\n", err)
		return
	}

	for _, symbol := range symbolsToCheck {
		// 2. Buscamos el precio actual en Yahoo
		currentPrice, err := w.financeClient.GetCurrentPrice(symbol)
		if err != nil {
			fmt.Printf("Error obteniendo precio de %s: %v\n", symbol, err)
			continue
		}

		// 3. Buscamos todas las alertas activas en tu BD para ese símbolo
		alerts, err := w.alertRepo.GetActiveAlertsBySymbol(symbol)
		if err != nil || len(alerts) == 0 {
			continue
		}

		// 4. Chequeamos las matemáticas
		for _, alert := range alerts {
			isTriggered := false

			if alert.Condition == domain.ConditionAbove && currentPrice >= alert.TargetPrice {
				isTriggered = true
			} else if alert.Condition == domain.ConditionBelow && currentPrice <= alert.TargetPrice {
				isTriggered = true
			}

			if isTriggered {
				fmt.Printf("🎯 ¡ALERTA! %s cruzó el objetivo de %.2f\n", alert.Symbol, alert.TargetPrice)

				// Le tiramos la alerta al Dispatcher para que mande el mail
				w.dispatcher.DispatchPriceAlert(alert, currentPrice)

				// Apagamos la alerta para que no le mande mails infinitos al usuario
				w.alertRepo.Deactivate(alert.ID)
			}
		}
	}
}
