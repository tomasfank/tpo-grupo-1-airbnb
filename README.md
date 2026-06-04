# Airbnb TPO — Ingeniería de Datos II

Demo funcional en JavaScript que implementa una plataforma de alquileres temporarios usando **4 bases de datos** con roles diferenciados.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express (ES Modules) |
| Orquestación | Docker Compose |

---

## Arquitectura de datos

| Entidad | Base de datos | Justificación |
|---|---|---|
| `usuarios` | **MongoDB 7** | Documento flexible con campos opcionales (bio, teléfono). Schema fácil de evolucionar sin migraciones. |
| `propiedades` | **MongoDB 7** | Documento anidado con GeoJSON (`ubicacion.coords`). Índice `2dsphere` para búsqueda geoespacial nativa. |
| `reservas` + `pagos` | **PostgreSQL 17** | Transacciones ACID. Integridad referencial con `FOREIGN KEY`. Consistencia crítica para operaciones de pago. |
| `resenias` | **Cassandra 5** | Escritura append-only sin updates. Patrón "una tabla por query": `resenias_by_propiedad`, `resenias_by_anfitrion`. Escalable a alto volumen. |
| Recomendaciones / Grafo | **Neo4j 5** | Relaciones `(Usuario)-[:RESERVO]->(Propiedad)` y `(Usuario)-[:ANFITRIO]->(Propiedad)`. Collaborative filtering imposible de expresar eficientemente en SQL. |

### Esquema Cassandra (denormalizado)

```
resenias_by_propiedad  → PK: (propiedad_id)  CLUSTER: created_at DESC
resenias_by_anfitrion  → PK: (anfitrion_id)  CLUSTER: created_at DESC
resenias_by_reserva    → PK: (reserva_id)    — lookup de duplicados
```

### Grafo Neo4j

```
(:Usuario)-[:RESERVO]->(:Propiedad)
(:Usuario)-[:ANFITRIO]->(:Propiedad)
```

---

## Ejecutar

```bash
docker compose up --build
```

> **Nota:** Cassandra tarda ~90 segundos en arrancar. El backend reintenta la conexión automáticamente.

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API health | http://localhost:3000/api/health |

---

## Endpoints principales

### Autenticación y usuarios (MongoDB)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registrar nuevo usuario (huésped o anfitrión). Hashea password con bcrypt. |
| POST | `/api/auth/login` | Login con email + password. Devuelve perfil sin `password_hash`. |
| GET | `/api/usuarios` | Listar usuarios. Acepta `?tipo=huesped\|anfitrion`. |
| POST | `/api/usuarios` | Crear usuario (uso admin, acepta tipo `admin`). |
| GET | `/api/usuarios/:id` | Perfil del usuario. Si es anfitrión, incluye array `propiedades` activas (resuelto con `$lookup` en una sola query). |
| PUT | `/api/usuarios/:id` | Actualizar perfil (nombre, teléfono, bio). Bloquea cambios de `id` y `tipo`. |
| DELETE | `/api/usuarios/:id` | Eliminar usuario. |

### Propiedades (MongoDB)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/propiedades` | Listar propiedades. Acepta `?ciudad`, `?tipo`, `?precioMin`, `?precioMax`, `?lat&lng&radioKm`. |
| POST | `/api/propiedades` | Publicar propiedad (requiere `anfitrion_id` válido). |
| GET | `/api/propiedades/:id` | Detalle de propiedad con anfitrión y reseñas. |
| PUT | `/api/propiedades/:id` | Actualizar propiedad. |
| DELETE | `/api/propiedades/:id` | Soft-delete (cambia estado a `eliminada`). |

### Reservas y pagos (PostgreSQL)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/reservas` | Listar reservas. Acepta `?huesped_id`, `?anfitrion_id`, `?estado`. |
| POST | `/api/reservas` | Crear reserva con validación de disponibilidad (transacción ACID). |
| PATCH | `/api/reservas/:id/cancelar` | Cancelar reserva. |
| PATCH | `/api/reservas/:id/finalizar` | Finalizar reserva y marcar pago como completado. |

### Reseñas (Cassandra) y recomendaciones (Neo4j)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/resenias` | Crear reseña (solo sobre reservas completadas, una por reserva). |
| GET | `/api/resenias` | Listar todas las reseñas. |
| GET | `/api/resenias/anfitrion/:id` | Reseñas de un anfitrión. |
| GET | `/api/recomendaciones/:id` | Propiedades recomendadas por collaborative filtering (Neo4j). |

---

## Qué permite hacer

### Gestión de usuarios
- **Registrar** una cuenta nueva como huésped o anfitrión desde la pantalla de login (password hasheado con bcrypt, validación de email único)
- **Iniciar sesión** con email + password real; la sesión persiste en `localStorage`
- **Consultar el perfil** propio: nombre, tipo, email, teléfono, bio y rating acumulado
- **Editar el perfil** propio: nombre, teléfono y bio desde la pantalla "Mi cuenta" (tipo de cuenta no modificable)
- **Ver el perfil público de cualquier anfitrión** con todas sus propiedades activas desde Explorar → botón "Ver perfil" en cada card (usa `$lookup` en MongoDB, una sola query)

### Gestión de propiedades
- Publicar, editar y eliminar propiedades (soft-delete) como anfitrión
- Buscar propiedades por ciudad, tipo, precio máximo/mínimo y coordenadas geográficas (radio en km)

### Reservas y pagos
- Crear reservas con validación de disponibilidad de fechas (transacción ACID en PostgreSQL)
- Controlar capacidad máxima de huéspedes por propiedad
- Cancelar y finalizar reservas; pago actualizado automáticamente al finalizar

### Reseñas y recomendaciones
- Dejar reseñas solo sobre reservas completadas (una por reserva); recalcula `promedio_rating` de propiedad y anfitrión en MongoDB
- **Recomendaciones colaborativas**: Neo4j sugiere propiedades basándose en el historial de reservas de usuarios similares; cae a las mejor calificadas si no hay historial
