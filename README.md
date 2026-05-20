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

| Método | Ruta | Base |
|---|---|---|
| GET/POST | `/api/usuarios` | MongoDB |
| GET/PUT | `/api/usuarios/:id` | MongoDB |
| GET/POST | `/api/propiedades` | MongoDB |
| GET/PUT/DELETE | `/api/propiedades/:id` | MongoDB |
| GET/POST | `/api/reservas` | PostgreSQL |
| PATCH | `/api/reservas/:id/cancelar` | PostgreSQL |
| PATCH | `/api/reservas/:id/finalizar` | PostgreSQL |
| POST | `/api/resenias` | Cassandra |
| GET | `/api/resenias` | Cassandra |
| GET | `/api/resenias/anfitrion/:id` | Cassandra |
| GET | `/api/recomendaciones/:id` | Neo4j + MongoDB |

---

## Qué permite hacer

- Login simulado como huésped o anfitrión
- CRUD completo de usuarios y propiedades
- Búsqueda de propiedades por ciudad, tipo, precio y coordenadas geográficas
- Crear reservas con validación de disponibilidad, fechas y capacidad
- Pago embebido en la reserva; cancelar y finalizar
- Reseñas solo sobre reservas completadas; recalcula rating de propiedad y anfitrión
- **Recomendaciones colaborativas**: Neo4j sugiere propiedades basándose en el historial de reservas de usuarios similares
