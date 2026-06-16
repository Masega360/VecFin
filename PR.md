# feat/collaborative-wallet

## Resumen

Sistema de wallets colaborativas, marketplace de compra/venta de assets, leaderboard, y mejoras de performance y UX.

---

## Wallets Colaborativas

- **Migración 020**: Renombra `wallet.user_id` → `wallet.creator_id`. Crea tabla `wallet_member` (N:N entre users y wallets con roles `owner`/`admin`/`viewer`). Crea tabla `community_wallet` para fondos de comunidades. Crea tabla `transfer` para transferencias entre wallets. Migra datos existentes asignando al creator como owner.
- **Autorización por roles**: `ensureOwner` ahora valida via `wallet_member` — owner y admin pueden operar, viewer es solo lectura.
- **Listado de wallets**: `GET /wallets` ahora devuelve todas las wallets donde el usuario es miembro (no solo las que creó), incluyendo el campo `my_role`.
- **Endpoints nuevos**:
  - `POST /wallets/{id}/members` — agregar miembro (solo owner)
  - `GET /wallets/{id}/members` — listar miembros con nombre, apellido, email y rol
  - `DELETE /wallets/{id}/members/{user_id}` — remover miembro
  - `POST /wallets/{id}/transfers` — transferir assets entre wallets
  - `GET /wallets/{id}/transfers` — historial de transferencias
- **Front**: Pantallas `wallet-members.tsx` y `wallet-transfers.tsx` con autocomplete de wallets destino, autocomplete de tickers disponibles, validación de saldo en tiempo real, y botones condicionados por rol (viewers no ven transferencias ni agregar assets).

---

## Marketplace (Pozo de Liquidez)

- **Migración 021**: Crea tabla `market_pool` (ticker + quantity disponible) y `market_trade` (historial de operaciones).
- **Endpoints**:
  - `GET /marketplace` — lista el pozo con precios en USD (Yahoo)
  - `POST /marketplace/buy` — comprar ticker del pozo pagando con otro ticker (conversión via USD)
  - `POST /marketplace/sell` — vender ticker al pozo, recibir USDT equivalente
- **Front**: Tab "Mercado" con lista del pozo, modal de compra con conversión bidireccional en tiempo real (cambiás una cantidad → la otra se recalcula), modal de venta con preview de USDT a recibir, validación de fondos insuficientes con error inline y botón deshabilitado, selector de wallet.
- **Las operaciones del marketplace se registran en `transfer`** para que aparezcan en el historial de transferencias de la wallet.
- **Seed**: Pozo inicializado con 18 tickers (50 BTC, 500 ETH, 10k SOL, 200 AAPL, 1M USDT, etc.)

---

## Leaderboard

- **Endpoint**: `GET /leaderboard/portfolio`, `/diversified`, `/active`
- **Rankings**:
  - Top Holdings — usuarios con mayor cantidad total de assets
  - Más Diversificados — usuarios con más tickers distintos
  - Más Activos — usuarios con más transferencias realizadas
- **Front**: Tab "Ranking" con selector de categoría y lista con medallas 🥇🥈🥉

---

## Performance

- **Cache de precios en memoria** con TTL de 2 minutos (`internal/platform/cache/market_cache.go`). Wrappea el Yahoo client.
- **Fetch paralelo de precios**: `GetWalletDetails` ahora pide todos los precios con goroutines en paralelo en vez de secuencial. Primera carga ~1s, siguientes instantáneas.

---

## IA con contexto del usuario

- La IA (chat + recomendaciones) ahora recibe como system context:
  - Nombre, apellido, perfil de riesgo
  - Todas las wallets donde es miembro, con su rol (owner/admin/viewer)
  - Holdings con cantidades, precios y valuación en USD
  - Explicación de qué implica cada rol
  - Noticias relevantes de sus tickers
- **News siempre disponible** (sacado fuera del if de Gemini)
- **IA funciona con solo Bedrock** si no hay GEMINI_API_KEY

---

## Config

- `ASSET_SOURCE` en `.env` — `"own"` para assets propios, `"external"` para wallets externas (Yahoo). Default: external.

---

## Seed masivo

- 50 usuarios (login: `user1@vecfin.com` a `user50@vecfin.com`, password: `password123!`)
- 80 wallets con nombres variados
- ~320 assets (BTC, ETH, SOL, AAPL, NVDA, TSLA, etc.)
- ~240 membresías (owner + colaboradores)
- 30 transferencias de ejemplo
- Pool del marketplace con 18 tickers

---

## Archivos nuevos

- `backend/migrations/020_collaborative_wallet.up.sql` / `.down.sql`
- `backend/migrations/021_market_pool.up.sql` / `.down.sql`
- `backend/internal/repository/postgres_wallet_member_repository.go`
- `backend/internal/repository/postgres_community_wallet_repository.go`
- `backend/internal/repository/postgres_transfer_repository.go`
- `backend/internal/handler/leaderboard_handler.go`
- `backend/internal/handler/marketplace_handler.go`
- `backend/internal/platform/cache/market_cache.go`
- `backend/seed.sql`
- `mobile/app/wallet-members.tsx`
- `mobile/app/wallet-transfers.tsx`
- `mobile/components/tabs/LeaderboardTab.tsx`
- `mobile/components/tabs/MarketplaceTab.tsx`
