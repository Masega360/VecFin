<div align="center">

# 💰 VecFin

**Plataforma de gestión financiera personal centralizada**

[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go&logoColor=white)](https://golang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

</div>

---

## ¿Qué es VecFin?

VecFin centraliza en un único lugar la información financiera proveniente de billeteras virtuales, cuentas bancarias y brokers de criptomonedas. El objetivo es que el usuario pueda ver su patrimonio completo, analizar tendencias y recibir recomendaciones personalizadas generadas por IA — todo desde una sola plataforma.

---

## Funcionalidades principales

| Módulo | Descripción |
|---|---|
| **Panel consolidado** | Resumen unificado de liquidez disponible y valor total de activos |
| **Vinculación de plataformas** | Conexión con bancos, billeteras virtuales y brokers de cripto |
| **Análisis de tendencias** | Proyecciones de gastos y rendimientos basadas en historial del usuario |
| **Asistente IA** | Diagnósticos financieros y sugerencias de rebalanceo generados por LLM |
| **Comunidad** | Comunidades temáticas, publicaciones, noticias y seguimiento de usuarios |
| **Simulador financiero** | Simulación de plazos fijos e instrumentos de renta variable |

---

## Stack tecnológico

- **Backend:** Go
- **Base de datos:** PostgreSQL
- **Infraestructura:** Docker / Docker Compose
- **IA:** Integración con LLM vía API 
- **Autenticación:** JWT

---

## Estructura del proyecto

```
vecfin/
├── cmd/
│   └── api/            # Entrypoint principal
├── internal/
│   ├── auth/           # Autenticación y sesiones
│   ├── user/           # Gestión de usuarios y perfiles
│   ├── portfolio/      # Carteras y activos
│   ├── platform/       # Vinculación de plataformas externas
│   ├── community/      # Módulo social (comunidades, publicaciones)
│   ├── ai/             # Asistente financiero IA
│   ├── market/         # Datos de mercado (precios, activos)
│   └── notification/   # Alertas y notificaciones
├── pkg/
│   ├── db/             # Conexión y migraciones
│   └── middleware/     # Middlewares HTTP
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

---

## Primeros pasos

### Prerrequisitos

- [Go 1.22+](https://golang.org/dl/)
- [Docker](https://docs.docker.com/get-docker/) y Docker Compose

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Masega360/vecfin.git
cd vecfin

# 2. Copiar variables de entorno
cp .env.example .env
# Completar las variables en .env

# 3. Levantar la base de datos
docker compose up -d db

# 4. Correr el servidor
go run ./cmd/api
```

### Con Docker (todo el stack)

```bash
docker compose up --build
```

El servidor quedará disponible en `http://localhost:8080`.

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DB_URL` | Cadena de conexión PostgreSQL | `postgres://user:pass@localhost:5432/vecfin` |
| `JWT_SECRET` | Secreto para firma de tokens | `supersecret` |
| `AI_API_KEY` | API key del proveedor LLM | `sk-...` |
| `AI_API_URL` | URL base del proveedor LLM | `https://api.openai.com/v1` |
| `PORT` | Puerto del servidor HTTP | `8080` |

---

## API — Endpoints principales

```
POST   /auth/register          Registro de usuario
POST   /auth/login             Inicio de sesión

GET    /portfolio               Panel consolidado
GET    /portfolio/assets        Activos de la cartera
POST   /portfolio/assets        Agregar activo manualmente

GET    /platforms               Plataformas vinculadas
POST   /platforms               Vincular nueva plataforma
DELETE /platforms/:id           Desvincular plataforma

GET    /market/:symbol          Detalle de un activo
GET    /market/search           Búsqueda de activos

POST   /ai/diagnosis            Generar diagnóstico financiero
POST   /ai/rebalance            Obtener sugerencias de rebalanceo
GET    /ai/history              Historial de interacciones

GET    /community               Listado de comunidades
POST   /community               Crear comunidad
POST   /community/:id/post      Publicar en una comunidad
POST   /posts/:id/like          Likear una publicación
POST   /users/:id/follow        Seguir a un usuario
```

---

## Modelo de datos

El modelo completo está documentado en el diagrama ER del proyecto (`/docs/er-diagram.mermaid`). Las entidades principales son:

`USUARIO` · `PLATAFORMA` · `ACTIVO` · `CARTERA` · `TRANSACCION` · `DIAGNOSTICO_IA` · `COMUNIDAD` · `PUBLICACION` · `COMENTARIO` · `NOTICIA` · `SEGUIMIENTO`

---

## Casos de uso

La especificación completa de casos de uso está en `/docs/VecFin_Casos_de_Uso.docx`, organizada por actor:

- **Usuario anónimo** — registro, exploración de mercados y portfolios públicos
- **Usuario registrado** — gestión financiera completa, comunidad y asistente IA
- **Sistema** — actualización de noticias, recomendaciones automáticas, notificaciones

---

## Contribuir

1. Hacé un fork del repositorio
2. Creá una rama para tu feature: `git checkout -b feature/nombre`
3. Commiteá tus cambios: `git commit -m 'feat: descripción'`
4. Pusheá la rama: `git push origin feature/nombre`
5. Abrí un Pull Request

---

<div align="center">

© 2025 VecFin — Proyecto académico / en desarrollo / Derechos Reservados

</div>