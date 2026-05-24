# EmprendeMarket — Arquitectura de Microservicios

Plataforma de marketplace para emprendedores construida con **Node.js + Express + MongoDB** siguiendo arquitectura de microservicios. Migrada del proyecto original en Laravel (`portafolio_electiva_microservicios`). Misma paleta de colores, mismo dominio de negocio, cero PHP.

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Servicios](#servicios)
- [Comunicación entre servicios](#comunicación-entre-servicios)
- [Inicio rápido](#inicio-rápido)
- [Variables de entorno](#variables-de-entorno)
- [Rutas de la API](#rutas-de-la-api)
- [Base de datos](#base-de-datos)
- [Flujos principales](#flujos-principales)
- [Páginas disponibles](#páginas-disponibles)
- [Tecnologías](#tecnologías)
- [Paleta de colores](#paleta-de-colores)
- [Migración desde Laravel](#migración-desde-laravel)

---

## Arquitectura

```
Cliente (navegador)
        │
        ▼
┌───────────────────┐
│   API Gateway     │  :3000  ← punto de entrada único
│  (Express proxy)  │
└────────┬──────────┘
         │ proxy por prefijo de ruta
    ┌────┴────────────────────────────────────────┐
    │            │            │          │        │
    ▼            ▼            ▼          ▼        ▼
┌────────┐ ┌──────────┐ ┌─────────┐ ┌──────┐ ┌────────┐
│  Auth  │ │Productos │ │ Pedidos │ │Notif.│ │Reportes│
│ :3001  │ │  :3002   │ │  :3003  │ │:3004 │ │ :3006  │
└────────┘ └──────────┘ └────┬────┘ └──────┘ └────────┘
                              │ HTTP interno
                              └──► notificaciones-service
                                   productos-service (stock)

┌─────────────────────┐
│  Frontend Service   │  :3005  ← HTML/CSS/JS estático + uploads
└─────────────────────┘

Base de datos: MongoDB — emprendemarket_db (una instancia, colecciones por dominio)
```

---

## Servicios

| Servicio | Puerto | Descripción | Tecnologías |
|---|---|---|---|
| **API Gateway** | 3000 | Punto de entrada único, proxy inverso, health check | Express, http-proxy-middleware |
| **Auth Service** | 3001 | Registro, login, JWT, perfil, foto de perfil | Express, Mongoose, bcryptjs, jsonwebtoken, multer |
| **Productos Service** | 3002 | Productos, tiendas, favoritos, reseñas (con foto), tallas+stock | Express, Mongoose, multer |
| **Pedidos Service** | 3003 | Carrito (con talla), checkout, pedidos, envíos, direcciones | Express, Mongoose |
| **Notificaciones Service** | 3004 | Notificaciones push, mensajería directa entre usuarios | Express, Mongoose |
| **Frontend Service** | 3005 | Páginas HTML + assets estáticos + carpeta `/uploads` | Express static |
| **Reportes Service** | 3006 | Reportes/PQRS de compradores y vendedores | Express, Mongoose |

---

## Comunicación entre servicios

Los servicios se comunican mediante **HTTP REST** interno. No comparten código ni modelos — solo datos vía API.

### Endpoints internos (servicio a servicio)

Requieren el header `x-service-key: <INTERNAL_SERVICE_KEY>` en lugar de JWT.

| Servicio receptor | Endpoint interno | Llamado por |
|---|---|---|
| notificaciones-service | `POST /internal/notificaciones` | pedidos, productos, reportes |
| productos-service | `POST /internal/productos/bulk` | pedidos-service |
| productos-service | `POST /internal/stock/reducir` | pedidos-service |
| auth-service | `POST /auth/internal/usuarios/bulk` | productos-service |
| auth-service | `GET /auth/internal/usuarios` | reportes-service |

### Flujo de checkout

```
POST /api/checkout/procesar
        │
        ├── pedidos-service crea el pedido
        ├── POST /internal/productos/bulk   → obtener precios actuales
        ├── POST /internal/stock/reducir    → descontar stock
        ├── POST /internal/notificaciones   → notificar al comprador
        └── POST /internal/notificaciones   → notificar a cada vendedor involucrado
```

### Flujo de marcar enviado → recibido → reseña

```
Vendedor: POST /api/vendedor/pedidos/:id/marcar-enviado
        └── notifica al comprador: "tu pedido está en camino"

Comprador: POST /api/comprador/pedidos/:id/marcar-recibido
        ├── pedido.estado = 'entregado'
        ├── notifica al vendedor: "pedido entregado"
        ├── notifica al comprador: "¡gracias! deja tu reseña"
        └── devuelve detalles[] → el frontend abre el modal de reseña

Comprador: POST /api/resenas/upload-foto  (multer, opcional)
        └── devuelve { url: '/uploads/resenas/resena-xxx.jpg' }

Comprador: POST /api/resenas
        └── guarda { calificacion, comentario, foto_url, nombre_comprador }
```

---

## Inicio rápido

### Prerrequisitos

- Node.js 18+ (requerido para `fetch` nativo y `AbortSignal.timeout`)
- MongoDB corriendo en `localhost:27017`
- npm

### 1. Instalar dependencias de todos los servicios

```bat
install-all.bat
```
o manualmente:
```bash
npm run install:all
```

### 2. Inicializar la base de datos (primera vez)

```bash
npm run db:init
```

Crea colecciones, índices y un administrador por defecto:
- Correo: `admin@emprendemarket.com`
- Contraseña: `admin123`

### 3. Iniciar todos los servicios

**Windows (recomendado):**
```bat
start-all.bat
```
Abre 7 ventanas de consola, una por servicio.

**Individual:**
```bash
npm run start:gateway        # puerto 3000
npm run start:auth           # puerto 3001
npm run start:productos      # puerto 3002
npm run start:pedidos        # puerto 3003
npm run start:notificaciones # puerto 3004
npm run start:frontend       # puerto 3005
npm run start:reportes       # puerto 3006
```

### 4. Abrir en el navegador

```
http://localhost:3000
```

> **Todo pasa por el gateway en el puerto 3000.** No acceder directamente a los servicios individuales desde el frontend.

### Verificar estado de servicios

```
http://localhost:3000/gateway/services
```

---

## Variables de entorno

Cada servicio tiene su propio `.env`. Ejemplo de configuración:

### Auth Service (`auth-service/.env`)
```env
PORT=3001
MONGO_URI=mongodb://127.0.0.1:27017/emprendemarket_db
JWT_SECRET=emprendemarket_jwt_secret_2024_microservicios
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

### Productos Service (`productos-service/.env`)
```env
PORT=3002
MONGO_URI=mongodb://127.0.0.1:27017/emprendemarket_db
JWT_SECRET=emprendemarket_jwt_secret_2024_microservicios
NODE_ENV=development
NOTIFICACIONES_SERVICE_URL=http://localhost:3004
AUTH_SERVICE_URL=http://localhost:3001
INTERNAL_SERVICE_KEY=emprendemarket_internal_2024
```

### Pedidos Service (`pedidos-service/.env`)
```env
PORT=3003
MONGO_URI=mongodb://127.0.0.1:27017/emprendemarket_db
JWT_SECRET=emprendemarket_jwt_secret_2024_microservicios
NODE_ENV=development
NOTIFICACIONES_SERVICE_URL=http://localhost:3004
PRODUCTOS_SERVICE_URL=http://localhost:3002
INTERNAL_SERVICE_KEY=emprendemarket_internal_2024
```

### Notificaciones Service (`notificaciones-service/.env`)
```env
PORT=3004
MONGO_URI=mongodb://127.0.0.1:27017/emprendemarket_db
JWT_SECRET=emprendemarket_jwt_secret_2024_microservicios
NODE_ENV=development
INTERNAL_SERVICE_KEY=emprendemarket_internal_2024
```

### Reportes Service (`reportes-service/.env`)
```env
PORT=3006
MONGO_URI=mongodb://127.0.0.1:27017/emprendemarket_db
JWT_SECRET=emprendemarket_jwt_secret_2024_microservicios
NODE_ENV=development
AUTH_SERVICE_URL=http://localhost:3001
NOTIFICACIONES_SERVICE_URL=http://localhost:3004
PRODUCTOS_SERVICE_URL=http://localhost:3002
INTERNAL_SERVICE_KEY=emprendemarket_internal_2024
```

### Gateway (`gateway/.env`)
```env
PORT=3000
JWT_SECRET=emprendemarket_jwt_secret_2024_microservicios
AUTH_SERVICE_URL=http://localhost:3001
PRODUCTOS_SERVICE_URL=http://localhost:3002
PEDIDOS_SERVICE_URL=http://localhost:3003
NOTIFICACIONES_SERVICE_URL=http://localhost:3004
FRONTEND_SERVICE_URL=http://localhost:3005
REPORTES_SERVICE_URL=http://localhost:3006
```

---

## Rutas de la API

Todas las rutas se acceden a través del gateway en `http://localhost:3000`.

### Autenticación (`/api/auth`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | No | Registrar usuario |
| POST | `/api/auth/login` | No | Iniciar sesión |
| POST | `/api/auth/logout` | No | Cerrar sesión |
| GET | `/api/auth/me` | JWT | Perfil del usuario autenticado |
| POST | `/api/auth/verify` | No | Verificar validez de token JWT |
| PUT | `/api/auth/perfil` | JWT | Actualizar datos de perfil |
| POST | `/api/auth/perfil/foto` | JWT | Subir foto de perfil (multipart) |

### Productos y tiendas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/productos` | No | Listar productos activos (filtros: `categoria`, `buscar`, `tienda`, `pagina`, `limite`) |
| GET | `/api/productos/:id` | No | Detalle de producto (incluye tienda, reseñas, promoción activa, tallas con stock) |
| GET | `/api/tiendas` | No | Listar tiendas activas |
| GET | `/api/tiendas/:id` | No | Detalle de tienda con sus productos |
| POST | `/api/tiendas` | Emprendedor | Crear tienda (queda `pendiente` hasta aprobación) |
| POST | `/api/vendedor/upload-imagen` | Emprendedor | Subir imagen de producto (multipart) |
| GET | `/api/vendedor/productos` | Emprendedor | Mis productos + datos de tienda |
| POST | `/api/vendedor/productos` | Emprendedor | Crear producto (incluye `tallas: [{nombre, stock}]`) |
| PUT | `/api/vendedor/productos/:id` | Emprendedor | Actualizar producto |
| DELETE | `/api/vendedor/productos/:id` | Emprendedor | Desactivar producto |
| POST | `/api/vendedor/productos/:id/reponer-stock` | Emprendedor | Reponer stock global |

### Tallas y formato de producto

Los productos soportan tallas con stock individual:
```json
{
  "nombre_producto": "Blusa Dama",
  "precio": 50000,
  "stock": 17,
  "categoria": "Ropa",
  "tallas": [
    { "nombre": "S", "stock": 5 },
    { "nombre": "M", "stock": 7 },
    { "nombre": "L", "stock": 5 }
  ]
}
```
> Compatible con el formato antiguo `tallas: ["S", "M", "L"]` (array de strings). El frontend detecta el tipo y lo renderiza correctamente.

### Favoritos y reseñas

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/favoritos` | JWT | Mis favoritos |
| POST | `/api/favoritos` | JWT | Agregar favorito |
| DELETE | `/api/favoritos/:id` | JWT | Quitar favorito |
| POST | `/api/resenas/upload-foto` | JWT | Subir foto de reseña (multipart, devuelve `url`) |
| POST | `/api/resenas` | JWT | Crear reseña con calificación (1–5 ★), comentario y `foto_url` opcional |

### Carrito y pedidos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/carrito` | JWT | Ver carrito |
| POST | `/api/carrito/agregar` | JWT | Agregar al carrito (`{ id_producto, cantidad, talla? }`) |
| PUT | `/api/carrito/:id` | JWT | Actualizar cantidad de un ítem |
| DELETE | `/api/carrito/:id` | JWT | Quitar ítem del carrito |
| DELETE | `/api/carrito` | JWT | Vaciar carrito completo |
| POST | `/api/checkout/procesar` | JWT | Procesar pago y crear pedido |
| GET | `/api/comprador/pedidos` | JWT | Mis pedidos |
| GET | `/api/comprador/pedidos/:id` | JWT | Detalle de pedido |
| POST | `/api/comprador/pedidos/:id/marcar-recibido` | JWT | Confirmar recepción (devuelve `detalles[]` para reseña) |
| GET | `/api/comprador/mis-vendedores` | JWT | Tiendas únicas de mis compras (para reportes) |

### Panel vendedor — pedidos

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/vendedor/pedidos` | Emprendedor | Todos los pedidos |
| POST | `/api/vendedor/pedidos/:id/procesar` | Emprendedor | Marcar en preparación |
| POST | `/api/vendedor/pedidos/:id/marcar-enviado` | Emprendedor | Marcar enviado (con guía opcional) |

### Notificaciones y mensajes

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/notificaciones` | JWT | Mis notificaciones |
| GET | `/api/notificaciones/no-leidas` | JWT | Contador de no leídas |
| POST | `/api/notificaciones/:id/marcar-leida` | JWT | Marcar una como leída |
| POST | `/api/notificaciones/marcar-todas-leidas` | JWT | Marcar todas como leídas |
| DELETE | `/api/notificaciones/:id` | JWT | Eliminar notificación |
| GET | `/api/mensajes` | JWT | Mis conversaciones |
| GET | `/api/mensajes/:id` | JWT | Mensajes de una conversación |
| POST | `/api/mensajes/enviar` | JWT | Enviar mensaje |
| GET | `/api/mensajes-usuarios` | JWT | Usuarios disponibles para mensajear |

### Reportes / PQRS

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/reportes` | JWT | Mis reportes (comprador: enviados; vendedor: enviados + recibidos; admin: todos) |
| POST | `/api/reportes` | JWT | Crear reporte (`tipo_destinatario`: `admin` / `vendedor` / `ambos`) |
| POST | `/api/reportes/:id/estado` | Admin | Cambiar estado y añadir respuesta |

### Panel administrador

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/admin/tiendas` | Admin | Listar todas las tiendas |
| POST | `/api/admin/tiendas/:id/estado` | Admin | Aprobar / suspender tienda |
| GET | `/api/admin/productos` | Admin | Listar todos los productos |
| POST | `/api/admin/productos/:id/desactivar` | Admin | Desactivar producto |

### Gateway

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/gateway/health` | No | Estado del gateway |
| GET | `/gateway/services` | No | Estado y latencia de todos los microservicios |

---

## Base de datos

MongoDB — base de datos: `emprendemarket_db`

| Colección | Servicio responsable | Descripción |
|---|---|---|
| `usuarios` | auth-service | Usuarios registrados (compradores, emprendedores, admin) |
| `tiendas` | productos-service | Tiendas de emprendedores |
| `productos` | productos-service | Catálogo (campo `tallas` soporta `[String]` y `[{nombre,stock}]`) |
| `productos_imagenes` | productos-service | Imágenes adicionales de productos |
| `favoritos` | productos-service | Favoritos por usuario |
| `resenas` | productos-service | Reseñas con calificación, comentario y foto opcional |
| `carrito` | pedidos-service | Ítems del carrito (incluye campo `talla`) |
| `pedidos` | pedidos-service | Órdenes de compra (detalles embebidos con `talla` e `imagen_url`) |
| `direcciones` | pedidos-service | Direcciones de envío por usuario |
| `metodos_pago` | pedidos-service | Métodos de pago (tarjeta enmascarada) |
| `notificaciones` | notificaciones-service | Notificaciones push del sistema |
| `mensajes` | notificaciones-service | Mensajes directos entre usuarios |
| `reportes` | reportes-service | Reportes/PQRS (con `id_destinatario` para vendor targeting) |

### Uploads (archivos subidos)

Los archivos se guardan en `frontend-service/public/uploads/` y se sirven como archivos estáticos:

| Carpeta | Tipo | Endpoint de subida |
|---|---|---|
| `/uploads/productos/` | Imágenes de productos | `POST /api/vendedor/upload-imagen` |
| `/uploads/resenas/` | Fotos de reseñas | `POST /api/resenas/upload-foto` |
| `/uploads/perfiles/` | Fotos de perfil | `POST /api/auth/perfil/foto` |

---

## Flujos principales

### Registro e inicio de sesión
1. `POST /api/auth/register` o `POST /api/auth/login`
2. auth-service devuelve JWT + datos del usuario
3. Frontend guarda token en `localStorage`, redirige según rol

### Compra de un producto (con talla)
1. Comprador ve detalle → selecciona talla (obligatorio si el producto tiene tallas)
2. `POST /api/carrito/agregar` → `{ id_producto, cantidad, talla }`
3. En `/checkout` → `POST /api/checkout/procesar`
4. pedidos-service crea el pedido, descuenta stock, notifica comprador y vendedores
5. Confirmación en `/confirmacion-compra`

### Entrega y reseña
1. Vendedor marca enviado → comprador recibe notificación
2. Comprador marca recibido → `POST /api/comprador/pedidos/:id/marcar-recibido`
3. El endpoint devuelve `detalles[]`; el frontend abre automáticamente el modal de reseña
4. Comprador selecciona ★ (1–5), escribe comentario, sube foto opcional
5. Frontend sube foto (`POST /api/resenas/upload-foto`) y luego envía reseña (`POST /api/resenas`)
6. La reseña aparece en la página del producto con nombre, fecha, estrellas y foto

### Gestión de tienda (emprendedor)
1. Emprendedor crea tienda → estado `pendiente`
2. Admin aprueba → `POST /api/admin/tiendas/:id/estado`
3. Emprendedor puede crear productos con tallas y stock por talla
4. El panel de "Mis Productos" muestra los chips de talla con su stock

### Reportes
- **Comprador:** puede reportar a admin, a un vendedor específico, o a ambos
- **Vendedor:** ve en su panel los reportes que envió **y** los que le llegaron de compradores
- **Admin:** ve todos los reportes y puede cambiar su estado con respuesta

---

## Páginas disponibles

| URL | Página | Rol requerido |
|---|---|---|
| `/` | Landing / Inicio | Público |
| `/marketplace` | Catálogo de productos (filtros, búsqueda, paginación) | Público |
| `/producto/:id` | Detalle de producto (tallas, reseñas ★, favoritos) | Público |
| `/tienda/:id` | Detalle de tienda con sus productos | Público |
| `/login` | Login / Registro | Público |
| `/carrito` | Carrito de compras (con talla por ítem) | Autenticado |
| `/checkout` | Proceso de pago | Autenticado |
| `/confirmacion-compra` | Confirmación de pedido | Autenticado |
| `/comprador/dashboard` | Dashboard comprador (pedidos, favoritos, reseñas, reportes, perfil) | Comprador |
| `/vendedor/dashboard` | Dashboard vendedor (productos, pedidos, tienda, reportes enviados/recibidos, mensajes, perfil) | Emprendedor |
| `/admin/dashboard` | Panel administración (usuarios, tiendas, productos, pedidos, reportes, estadísticas) | Administrador |

---

## Tecnologías

| Área | Tecnología |
|---|---|
| Runtime | Node.js 18+ |
| Framework backend | Express.js |
| Base de datos | MongoDB + Mongoose (`strict: false` para esquemas flexibles) |
| Autenticación | JWT (jsonwebtoken) + bcryptjs |
| Proxy / Gateway | http-proxy-middleware v3 |
| Upload de archivos | multer (imágenes de productos, reseñas y perfiles) |
| Frontend | HTML5, CSS3, Bootstrap 5.3, Vanilla JS (ES2018+) |
| Tipografía | Google Fonts — Open Sans + Merriweather |
| Iconos | Google Material Symbols (outlined, variable) |
| Compat. hash | Compatible con hashes `$2y$` de PHP/Laravel |

---

## Paleta de colores

Paleta original del proyecto Laravel, preservada íntegramente en variables CSS (`frontend-service/public/css/estilos.css`):

| Token CSS | Descripción | Hex |
|---|---|---|
| `--primary` | Ámbar principal | `#D97706` |
| `--primary-light` | Ámbar claro | `#FBBF24` |
| `--primary-dark` | Ámbar oscuro | `#B45309` |
| `--secondary` | Crema cálido | `#FFF7ED` |
| `--background` | Fondo neutro | `#FAFAF9` |
| `--accent` | Verde esmeralda | `#10B981` |
| `--dark` | Texto oscuro | `#1C1917` |
| `--error` | Rojo error | `#EF4444` |

---

## Migración desde Laravel

| Laravel (`portafolio_electiva_microservicios`) | Microservicios (Node.js) |
|---|---|
| `UserController` | `auth-service/src/controllers/authController.js` |
| `InicioController` | `frontend-service` + `productos-service` |
| `VendedorController` | `productos-service` (rutas `/vendedor/*`) |
| `CompradorController` | `pedidos-service` (rutas `/comprador/*`) |
| `CarritoController` | `pedidos-service/src/controllers/carritoController.js` |
| `AdminController` | `productos-service` + `pedidos-service` (rutas `/admin/*`) |
| `MensajeController` | `notificaciones-service` |
| `NotificacionController` | `notificaciones-service` |
| `ReporteController` | `reportes-service/src/controllers/reportesController.js` |
| `routes/web.php` | `gateway/src/index.js` (proxy por prefijo) + rutas de cada servicio |
| `resources/views/*.blade.php` | `frontend-service/public/pages/*.html` |
| MySQL / Eloquent ORM | MongoDB / Mongoose |
| Sesiones PHP + cookies | JWT en `localStorage` |
| `storage/app/public` | `frontend-service/public/uploads/` |
