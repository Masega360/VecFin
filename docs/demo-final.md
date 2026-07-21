# Demo Final - VecFin
## Historia de la demo

**Personaje:** Tomás, 25 años, recién recibido, quiere empezar a invertir pero no sabe por dónde arrancar. Busca una app que lo ayude a gestionar sus inversiones, aprender de una comunidad y tener un asistente que lo guíe.

---

## 1. ABM/CRUD Usuario

> "Tomás se descarga VecFin y se registra."

- Mostrar pantalla de **Landing** → tocar "Entrar"
- **Registrarse** con Google (o email/contraseña)
- Ver el **perfil** creado (nombre, email, tipo de riesgo)
- **Editar perfil**: cambiar nombre, perfil de riesgo a "moderado"
- Mostrar **configuración de privacidad** (perfil privado, ocultar wallets, etc.)

---

## 2. ABM/CRUD Activos

> "Tomás quiere ver qué activos hay disponibles para invertir."

- Ir a la tab **Assets**
- **Buscar** un activo: "AAPL" (Apple)
- Ver el **detalle del activo**: precio, variación, gráfico histórico (7d, 1m, 3m, 1y)
- **Agregar a favoritos** ⭐
- Ver la lista de favoritos
- **Eliminar de favoritos**

---

## 3. ABM/CRUD Transacción y Cartera (Wallets)

> "Tomás crea su primera cartera y empieza a registrar lo que tiene."

- Ir a la tab **Wallets**
- **Crear wallet** manual: "Mi Portfolio"
- **Agregar activos** a la wallet: BTC-USD (0.5), AAPL (10)
- Ver el **detalle de la wallet** con valuación en tiempo real (precio × cantidad)
- **Editar cantidad** de un activo
- **Eliminar activo** de la wallet
- **Transferir** activos entre wallets (crear otra wallet primero)

---

## 4. ABM Comunidades y Publicaciones

> "Tomás quiere aprender de otros inversores, se une a una comunidad."

- Ir a tab **Comunidad**
- **Buscar** una comunidad existente (ej: "Crypto Argentina")
- **Unirse** a la comunidad
- Ver los **posts** de la comunidad
- **Crear un post**: "¿Qué opinan de ETH a largo plazo?"
- **Votar** (upvote/downvote) en un post
- **Comentar** en un post
- **Crear su propia comunidad**: "Inversores Novatos" (pública)

---

## 5. Integrar plataforma externa (IOL + Binance)

> "Tomás ya tiene activos en Binance y en IOL. Quiere importarlos."

- Ir a tab **Exchanges**
- Mostrar que están **Binance** e **IOL** como plataformas disponibles
- **Crear wallet conectada**: elegir Binance, poner API key/secret
- **Sincronizar** → importa los holdings automáticamente
- Mostrar que IOL funciona igual (username/password de IOL)

---

## 6. Notificaciones (alertas de precio + mail + in-app)

> "Tomás quiere que le avisen si Bitcoin baja de 60.000."

- Ir a un activo → **Crear alerta de precio**: BTC-USD < 60000
- Mostrar la **configuración de notificaciones** en el perfil (email + in-app activados)
- Mostrar la tab de **Avisos** (notificaciones in-app)
- Mostrar el **email recibido** con el botón "Abrir VecFin" (abrir Gmail)

---

## 7. Simulador financiero

> "Tomás quiere simular cuánto tendría si invierte $100.000 en un FCI al 5% anual por 5 años."

- Ir a tab **Simulador**
- Configurar: monto inicial, tasa, plazo, aportes mensuales
- Ver el **gráfico de proyección** y resultado final
- Comparar escenarios (conservador vs agresivo)

---

## 8. Chatbot asistente financiero IA

> "Tomás no entiende qué es un CEDEAR. Le pregunta al asistente."

- Ir a tab **Chat IA**
- Crear nueva sesión
- Preguntar: "¿Qué es un CEDEAR y me conviene invertir?"
- Mostrar que la IA **conoce su portfolio** (usa contexto de sus wallets)
- Preguntar: "¿Cómo está mi portfolio? ¿Qué debería cambiar?"
- Mostrar el **consumo de tokens** y el sistema de saldo

---

## 9. Integración con Yahoo Finanzas (noticias)

> "Tomás quiere estar al día con las noticias del mercado."

- Ir a tab **Noticias**
- Ver las noticias de tendencia (hot topics)
- Buscar noticias de un activo específico
- Mostrar que la **IA usa las noticias** como contexto (preguntar en el chat "¿qué noticias hay de Apple?")

---

## 10. Dashboard de performance

> "Tomás quiere ver un resumen de cómo va su inversión."

- Ir a tab **Dashboard**
- Ver: patrimonio total, cantidad de wallets, alertas activas, seguidores
- Distribución de activos
- Performance general

---

## 11. Exportar reportes

> "Tomás necesita presentar sus tenencias al contador para la declaración jurada."

- Ir a **Perfil** → "Descargar reporte fiscal"
- Se descarga un **PDF** con todas sus tenencias valuadas + uso de IA
- En una **comunidad** → Gestión → Exportar wallets en **PDF/CSV/Excel**

---

## 12. Colaboración (wallet compartida con permisos)

> "Tomás y su hermano quieren manejar una wallet entre los dos."

- Crear una wallet: "Fondo Familiar"
- **Agregar miembro**: invitar al hermano (buscar por ID)
- Asignar rol: **admin** (puede operar) o **viewer** (solo lectura)
- El hermano agrega activos a la wallet compartida
- Mostrar la **lista de miembros** con roles
- **Transferir** activos de la wallet personal a la compartida
- Mostrar que el viewer **no puede** modificar

---

## 13. Carga de saldo con MercadoPago (caso de uso final)

> "Tomás se queda sin mensajes gratuitos y necesita cargar saldo."

- Ir a tab **Saldo**
- Ver: 0 usos gratuitos restantes, saldo $0
- Tocar **$1000** → se abre MercadoPago
- Pagar con tarjeta de prueba
- Volver → ver saldo actualizado y badge **⭐ Premium**
- Mostrar que ahora puede mandar mensajes más largos (4000 chars)

---

## 14. Integración IOL (caso de uso final)

> "Tomás tiene acciones argentinas en InvertirOnline y quiere verlas acá."

- Mostrar IOL como plataforma en Exchanges
- Crear wallet conectada con credenciales de IOL
- Sincronizar → se importan las acciones/bonos/CEDEARs

---

## 15. Exportar wallet de comunidad (caso de uso final)

> "El líder de la comunidad quiere compartir el portfolio grupal con todos."

- Entrar a una comunidad como owner
- Gestión → **Vincular wallet** (elegir del selector)
- Los miembros ven las wallets compartidas en "Acerca de"
- Exportar en **PDF, CSV o Excel**

---

## 16. Deploy en AWS (caso de uso final)

> "La app está deployada en la nube para que cualquiera pueda usarla."

- Frontend: https://rover-lately-closed-cubic.trycloudflare.com
- Backend: https://headline-period-consumers-attract.trycloudflare.com
- Infraestructura: EC2 + Docker Compose + PostgreSQL + Cloudflare Tunnel (HTTPS)
- Health check: /health → {"status":"ok"}

---

## 17. Ranking de inversores

> "Tomás quiere ver quién es el mejor inversor de la plataforma."

- Ir a tab **Ranking**
- Ver el leaderboard de inversores por performance
- Ver su posición

---

## Datos de prueba

- **Usuarios del seed:** user1@vecfin.com a user50@vecfin.com / password: `password123!`
- **Tu usuario real:** (el que registraste con Google)
- **Tarjeta de prueba MP:** Visa 4509 9535 6623 3704, CVV 123, vto futuro, DNI 12345678
