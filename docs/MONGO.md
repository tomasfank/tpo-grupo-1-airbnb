# Esquema de colecciones MongoDB

MongoDB almacena los **datos maestros** del sistema: usuarios y propiedades (esquema flexible, búsqueda geoespacial) y una caché de reseñas para recalcular promedios de rating. Ver [DB-DECISIONS.md](DB-DECISIONS.md) para la justificación de por qué estos datos viven en Mongo.

---

## Colección `usuarios`

Almacena el perfil completo de cada usuario del sistema.

### Campos

| Campo            | Tipo    | Requerido | Descripción                                                  |
|------------------|---------|-----------|--------------------------------------------------------------|
| `_id`            | ObjectId | auto      | ID interno de Mongo (no expuesto por la API)                 |
| `id`             | String  | sí        | UUID v4 — identificador usado en todos los endpoints y FKs  |
| `nombre`         | String  | sí        | Nombre completo del usuario                                  |
| `email`          | String  | sí        | Email único. Usado para login                                |
| `password_hash`  | String  | sí        | Hash bcrypt de la contraseña. Excluido de las respuestas API |
| `tipo`           | String  | sí        | `"huesped"` \| `"anfitrion"` \| `"admin"`                   |
| `telefono`       | String  | no        | Teléfono de contacto (puede estar vacío)                     |
| `bio`            | String  | no        | Descripción libre del usuario (puede estar vacía)            |
| `promedio_rating`| Number  | sí        | Promedio calculado de todas las reseñas recibidas (solo anfitriones). Valor inicial `0` |
| `created_at`     | String  | sí        | Fecha de creación en formato ISO 8601                        |

### Índices

```js
{ id: 1 }    // unique — clave de búsqueda principal
{ email: 1 } // unique — login y validación de duplicados
```

### Documento de ejemplo

```json
{
  "id": "11111111-0001-0001-0001-000000000001",
  "nombre": "Ana Gómez",
  "email": "ana.host@mail.com",
  "tipo": "anfitrion",
  "telefono": "1111-2222",
  "bio": "Host con foco en estadías urbanas.",
  "promedio_rating": 4.5,
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

> `password_hash` se omite de todos los ejemplos porque la API nunca lo expone.

---

## Colección `propiedades`

Almacena cada alojamiento publicado por un anfitrión.

### Campos

| Campo               | Tipo     | Requerido | Descripción                                                        |
|---------------------|----------|-----------|--------------------------------------------------------------------|
| `_id`               | ObjectId | auto      | ID interno de Mongo                                                |
| `id`                | String   | sí        | UUID v4                                                            |
| `anfitrion_id`      | String   | sí        | UUID del usuario anfitrión dueño de la propiedad                  |
| `titulo`            | String   | sí        | Título del alojamiento                                             |
| `tipo`              | String   | sí        | `"departamento"` \| `"casa"` \| `"loft"` \| otros                 |
| `descripcion`       | String   | no        | Descripción larga del alojamiento                                  |
| `ubicacion`         | Object   | sí        | Subdocumento embebido — ver detalle abajo                         |
| `precio_noche`      | Number   | sí        | Precio por noche en pesos argentinos                               |
| `cantidad_huespedes`| Number   | sí        | Capacidad máxima de huéspedes                                      |
| `servicios`         | String[] | sí        | Lista de servicios disponibles (`"wifi"`, `"pileta"`, etc.)        |
| `estado`            | String   | sí        | `"activa"` \| `"eliminada"` (soft delete)                          |
| `promedio_rating`   | Number   | sí        | Promedio de calificaciones recibidas. Valor inicial `0`            |
| `imagen`            | String   | no        | URL de imagen principal                                            |

### Subdocumento `ubicacion`

| Campo       | Tipo   | Descripción                                                    |
|-------------|--------|----------------------------------------------------------------|
| `ciudad`    | String | Ciudad donde se ubica la propiedad                             |
| `pais`      | String | País                                                           |
| `direccion` | String | Dirección textual                                              |
| `coords`    | Object | GeoJSON Point: `{ type: "Point", coordinates: [lng, lat] }`   |

> Las coordenadas siguen el orden **[longitud, latitud]** requerido por GeoJSON.

### Índices

```js
{ id: 1 }                   // unique — clave de búsqueda principal
{ "ubicacion.coords": "2dsphere" } // búsqueda geoespacial con $geoNear
{ anfitrion_id: 1 }         // filtro frecuente: propiedades de un anfitrión
```

### Documento de ejemplo

```json
{
  "id": "33333333-0001-0001-0001-000000000001",
  "anfitrion_id": "11111111-0001-0001-0001-000000000001",
  "titulo": "Depto luminoso en Palermo",
  "tipo": "departamento",
  "descripcion": "Cerca de bares, subte y zona gastronómica.",
  "ubicacion": {
    "ciudad": "Buenos Aires",
    "pais": "Argentina",
    "direccion": "Av. Santa Fe 3200",
    "coords": { "type": "Point", "coordinates": [-58.421, -34.589] }
  },
  "precio_noche": 60000,
  "cantidad_huespedes": 3,
  "servicios": ["wifi", "aire acondicionado", "cocina"],
  "estado": "activa",
  "promedio_rating": 4.5,
  "imagen": "https://images.unsplash.com/..."
}
```

---

## Colección `resenias_cache`

Copia ligera de cada reseña, usada **exclusivamente** para recalcular los campos `promedio_rating` de `propiedades` y `usuarios`. Los datos completos de las reseñas viven en Cassandra.

### Campos

| Campo          | Tipo   | Descripción                                              |
|----------------|--------|----------------------------------------------------------|
| `_id`          | ObjectId | ID interno de Mongo                                    |
| `id`           | String | UUID de la reseña (mismo que en Cassandra)              |
| `reserva_id`   | String | UUID de la reserva a la que pertenece la reseña         |
| `propiedad_id` | String | UUID de la propiedad reseñada                           |
| `anfitrion_id` | String | UUID del anfitrión de la propiedad                      |
| `huesped_id`   | String | UUID del huésped que escribió la reseña                 |
| `calificacion` | Number | Puntuación entre 1 y 5                                  |

### Índices

```js
{ propiedad_id: 1 } // recalcular promedio de propiedad
{ anfitrion_id: 1 } // recalcular promedio de anfitrión
{ reserva_id: 1 }   // verificar si una reserva ya tiene reseña cacheada
```

### Documento de ejemplo

```json
{
  "id": "aaaaaaaa-0001-0001-0001-000000000001",
  "reserva_id": "bbbbbbbb-0001-0001-0001-000000000001",
  "propiedad_id": "33333333-0001-0001-0001-000000000001",
  "anfitrion_id": "11111111-0001-0001-0001-000000000001",
  "huesped_id": "22222222-0001-0001-0001-000000000001",
  "calificacion": 5
}
```

---

## Queries por caso de uso — Gestión de usuarios

| Caso de uso                                           | Función en `mongo.js`             |
|-------------------------------------------------------|-----------------------------------|
| Registrar usuario (huésped o anfitrión)               | `createUsuario(doc)`              |
| Verificar email duplicado antes de registrar          | `getUserByEmail(email)`           |
| Consultar perfil de cualquier usuario                 | `getUserById(id)`                 |
| Listar todos los usuarios (con filtro opcional `tipo`)| `getUsuarios(filtro)`             |
| Actualizar perfil (nombre, bio, teléfono, imagen)     | `updateUsuario(id, patch)`        |
| Actualizar contraseña                                 | `updatePassword(id, newHash)`     |
| Ver perfil de anfitrión con sus propiedades activas   | `getAnfitrionConPropiedades(id)`  |
| Eliminar usuario                                      | `deleteUsuario(id)`               |
| Login — obtener doc completo incluyendo hash          | `getUserByEmail(email)` (auth only)|
