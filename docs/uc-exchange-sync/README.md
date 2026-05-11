# Exchange Wallet Sync

Integración de APIs de exchanges externos para importar automáticamente los holdings de un usuario a sus wallets conectadas.

## Archivos

| Archivo | Descripción |
|---|---|
| `backend/internal/domain/exchange.go` | Interfaz `ExchangeService` y struct `ExchangeHolding` |
| `backend/internal/domain/errors.go` | Errores `ErrNoAPICredentials`, `ErrExchangeNotSupported` |
| `backend/internal/platform/binance/client.go` | Implementación de Binance con HMAC-SHA256 |
| `backend/internal/usecase/wallet_usecase.go` | Método `SyncFromExchange` y registry de exchanges |
| `backend/internal/handler/wallet_handler.go` | Endpoint `POST /wallets/{id}/sync` |
| `backend/cmd/api/main.go` | Wiring del registry de exchanges |

## Endpoint

```
POST /wallets/{id}/sync
Authorization: Bearer <jwt>
```

**Respuestas:**
- `204` — Sync exitoso
- `400` — Wallet sin credenciales o exchange no soportado
- `403` — La wallet no pertenece al usuario
- `404` — Wallet no encontrada

## Flujo

1. El handler extrae el `userID` del JWT y llama `SyncFromExchange`
2. El usecase verifica ownership y que la wallet tenga `api_key` y `api_secret`
3. Resuelve el nombre de la plataforma via `PlatformRepository`
4. Busca el `ExchangeService` correspondiente en el registry (`map[string]ExchangeService`)
5. Llama `GetHoldings(apiKey, apiSecret)` — el exchange firma la request y retorna los balances
6. Por cada holding: upsert en `asset_wallet` (add si no existe, update si ya existe)
7. Actualiza `last_sync` en la wallet

## Agregar un nuevo exchange

1. Crear `backend/internal/platform/<nombre>/client.go` implementando `domain.ExchangeService`
2. Registrarlo en `main.go`:

```go
exchanges := map[string]domain.ExchangeService{
    "binance":  binance.NewClient(),
    "coinbase": coinbase.NewClient(), // nuevo
}
```

El nombre de la clave debe coincidir (case-insensitive) con el campo `name` de la tabla `platform`.

## Diagramas

- `cl-exchange-sync.mermaid` — Diagrama de clases
- `se-exchange-sync.mermaid` — Diagrama de secuencia
