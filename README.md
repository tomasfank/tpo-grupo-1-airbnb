# Airbnb TPO - App Dockerizada

Demo funcional en JavaScript para el TPO de Ingeniería de Datos II.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Persistencia actual: memoria
- Bases levantadas en Docker para integración posterior:
  - MongoDB 7
  - PostgreSQL 17
  - Cassandra 5
  - Neo4J 5

## Ejecutar en Windows

Desde la carpeta del proyecto:

```powershell
docker compose up --build
```

Abrir:

```text
http://localhost:5173
```

API:

```text
http://localhost:3000/api/health
```

## Qué permite hacer

- Login simulado como huésped o anfitrión.
- Crear usuarios.
- Consultar perfiles.
- Publicar, editar parcialmente y eliminar propiedades.
- Buscar propiedades por ciudad, tipo, precio y coordenadas.
- Crear reservas asignadas a usuarios huésped.
- Validar disponibilidad, fechas y capacidad máxima.
- Registrar pago embebido en la reserva.
- Cancelar y finalizar reservas.
- Crear reseñas solo sobre reservas completadas.
- Recalcular rating promedio de propiedad y anfitrión.

## Nota de arquitectura

El backend todavía usa memoria para acelerar la demo de interfaz y API. La estructura ya separa recursos y endpoints para que luego se conecten los repositorios reales contra MongoDB, Cassandra, Neo4J y Postgres.
