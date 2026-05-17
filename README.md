# AirBnB TPO - App base dockerizada

Stack: React + Vite, Node.js + Express, MongoDB, Cassandra, Neo4J y Postgres.

## Windows / PowerShell

```powershell
npm install
npm run install:all
npm run dev
```

## Docker

```powershell
docker compose up --build
```

Frontend: http://localhost:5173  
Backend: http://localhost:3000/api/health

## Estado actual

La app funciona con persistencia en memoria para poder validar el flujo completo desde el front.
Las bases quedan levantadas en Docker y preparadas para conectar después mediante repositorios.

Funcionalidades incluidas:
- Login simulado por usuario.
- Alta y edición de usuarios.
- Alta, edición y eliminación lógica de propiedades.
- Búsqueda de propiedades por ciudad, tipo, precio y coordenadas.
- Vista de anfitrión con propiedades asociadas.
- Creación de reservas asignadas a huésped y propiedad.
- Validación de disponibilidad por rango de fechas.
- Validación de capacidad máxima de huéspedes.
- Cancelación y finalización de reservas.
- Pago embebido dentro de la reserva.
- Consulta de estado de pago.
- Creación de reseñas solo para reservas completadas.
- Consulta de reseñas por propiedad.
- Recalculo de rating promedio de propiedad y anfitrión.
