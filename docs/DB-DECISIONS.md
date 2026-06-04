# Decisiones de bases de datos

## Resumen

El sistema utiliza cuatro bases de datos, cada una elegida por sus fortalezas para el tipo de datos y patrón de acceso que le corresponde.

| Base de datos | Responsabilidad principal |
|---------------|--------------------------|
| **MongoDB**   | Usuarios y propiedades (datos maestros, esquema flexible, búsqueda geoespacial) |
| **PostgreSQL** | Reservas y pagos (transacciones ACID, integridad referencial, control de solapamientos) |
| **Cassandra** | Reseñas (escrituras de alta disponibilidad, lecturas por partición predefinida) |
| **Neo4j**     | Grafo de relaciones usuario–propiedad (recomendaciones colaborativas) |

---

## MongoDB — Usuarios y Propiedades

### Qué almacena
- Colección `usuarios`: perfil completo del usuario (nombre, email, tipo, bio, teléfono, promedio_rating, password_hash).
- Colección `propiedades`: datos del alojamiento con subdocumentos embebidos (`ubicacion` con coordenadas GeoJSON, array `servicios`).
- Colección `resenias_cache`: copia ligera de las reseñas usada exclusivamente para recalcular promedios de rating.

### Por qué MongoDB

1. **Esquema flexible**: las propiedades pueden tener distintos conjuntos de servicios (`wifi`, `pileta`, `estacionamiento`, etc.) sin necesidad de columnas fijas. MongoDB representa esto de forma natural como un array de strings embebido.

2. **Búsqueda geoespacial nativa**: el índice `2dsphere` sobre `ubicacion.coords` permite la consulta `$geoNear` para encontrar propiedades dentro de un radio en kilómetros sin extensiones externas.

3. **Subdocumentos embebidos**: `ubicacion` y `servicios` siempre se consultan junto a la propiedad; embeberlos elimina JOINs y reduce la latencia de lectura.

4. **Perfil de usuario variable**: el campo `bio` es opcional, los anfitriones tienen propiedades asociadas y los huéspedes no; MongoDB maneja esta variabilidad sin columnas nulas.

5. **`promedio_rating` precalculado**: los promedios se actualizan en el documento directamente tras cada reseña, evitando recalcular en cada consulta de perfil o listado de propiedades.

### Qué NO hace MongoDB aquí
No gestiona reservas ni pagos porque esos datos requieren garantías ACID y control de concurrencia que MongoDB no ofrece de forma nativa en múltiples documentos.

---

## PostgreSQL — Reservas y Pagos

### Qué almacena
- Tabla `reservas`: fechas de entrada/salida, estado (`confirmada`, `cancelada`, `completada`), cantidad de huéspedes, FK a usuario y propiedad.
- Tabla `pagos`: monto, método, estado del pago, con FK a `reservas` con `ON DELETE CASCADE`.

### Por qué PostgreSQL

1. **Transacciones ACID**: al crear una reserva, el sistema verifica la disponibilidad de fechas e inserta la reserva y el pago en una única transacción atómica con `BEGIN`/`COMMIT`/`ROLLBACK`. Si falla cualquier paso, todo se revierte. Esto es crítico para evitar reservas dobles.

2. **Control de solapamiento de fechas**: la consulta `fecha_inicio < $3 AND fecha_fin > $2` detecta conflictos de fechas; en una base no relacional sin transacciones esta verificación no sería confiable bajo concurrencia.

3. **Integridad referencial**: `pagos.reserva_id` referencia `reservas.id` con FK real. Garantiza que no exista un pago sin reserva asociada ni que se pueda eliminar una reserva sin eliminar su pago.

4. **Constraints declarativos**: `CHECK (fecha_inicio < fecha_fin)`, `CHECK (cantidad_huespedes > 0)`, y los enums de estado y método de pago se validan en la base de datos, no solo en la aplicación.

5. **Consultas relacionales simples**: el JOIN entre `reservas` y `pagos` en cada lectura es predecible y eficiente gracias a los índices de PK/FK.

### Qué NO hace PostgreSQL aquí
No almacena el perfil de usuarios ni propiedades porque esos datos tienen esquema variable y consultas de tipo flexible (filtros opcionales, búsqueda geográfica) que son más costosas en un esquema rígido relacional.

---

## Cassandra — Reseñas

### Qué almacena
Tres tablas siguiendo el patrón **una tabla por consulta**:

| Tabla | Clave de partición | Caso de uso |
|-------|--------------------|-------------|
| `resenias_by_propiedad` | `propiedad_id` | Ver todas las reseñas de un alojamiento |
| `resenias_by_anfitrion` | `anfitrion_id` | Ver historial de reseñas de un anfitrión |
| `resenias_by_reserva`   | `reserva_id`   | Verificar si una reserva ya tiene reseña |

### Por qué Cassandra

1. **Alta disponibilidad en escritura**: las reseñas son un flujo de escrituras append-only (nunca se editan ni eliminan). Cassandra está optimizada para este patrón; cada escritura se dirige a la partición correcta sin locks.

2. **Lecturas predecibles por partición**: las consultas más frecuentes ("ver reseñas de la propiedad X", "ver historial del anfitrión Y") se resuelven con una sola lectura a la partición exacta. No se necesita ALLOW FILTERING ni índices secundarios para los casos de uso principales.

3. **Ordenamiento por `created_at DESC` embebido**: el `CLUSTERING ORDER BY (created_at DESC)` en las tablas por propiedad y por anfitrión garantiza que las reseñas más recientes lleguen primero sin ORDER BY en la consulta.

4. **Batch atómico multi-tabla**: la inserción en las tres tablas se realiza con un `LOGGED BATCH`, lo que garantiza consistencia entre las copias desnormalizadas incluso si el nodo falla a mitad del proceso.

5. **Escalabilidad horizontal**: las reseñas son el dato que más crece con el tiempo. Cassandra escala horizontalmente añadiendo nodos sin degradar el rendimiento de escritura.

### Qué NO hace Cassandra aquí
No almacena usuarios ni propiedades porque Cassandra no soporta actualizaciones parciales eficientes ni consultas con filtros variables como los que se usan para buscar propiedades por ciudad, precio o tipo.

---

## Neo4j — Recomendaciones colaborativas

### Qué almacena
Dos tipos de nodos y dos tipos de relaciones:

```
(Usuario)-[:ANFITRIO]->(Propiedad)    // el anfitrión gestiona la propiedad
(Usuario)-[:RESERVO]->(Propiedad)     // el huésped reservó la propiedad
```

Los nodos contienen solo los atributos mínimos necesarios para el grafo (`id`, `nombre`, `tipo` en Usuario; `id`, `titulo`, `ciudad`, `tipo` en Propiedad). Los datos completos se obtienen desde MongoDB.

### Por qué Neo4j

1. **Filtrado colaborativo**: la query de recomendaciones expresa de forma directa el patrón "huéspedes que reservaron las mismas propiedades que tú también reservaron X":
   ```cypher
   MATCH (u)-[:RESERVO]->(p)<-[:RESERVO]-(otros)-[:RESERVO]->(rec)
   WHERE NOT (u)-[:RESERVO]->(rec)
   RETURN rec.id, count(*) AS score ORDER BY score DESC
   ```
   En SQL o MongoDB esta query requeriría múltiples JOINs o lookups que se vuelven costosos con volumen.

2. **Traversal nativo**: Neo4j almacena las relaciones como punteros directos entre nodos. Navegar el grafo en profundidad (amigos de amigos, propiedades de propiedades similares) tiene costo constante por salto, no por el tamaño total del grafo.

3. **Separación de responsabilidades**: el grafo solo necesita saber quién reservó qué, no los detalles de la reserva. Mantenerlo liviano permite que las queries de recomendación sean rápidas.

4. **Fallback por rating**: si un usuario no tiene historial de reservas, el sistema cae al fallback de propiedades mejor calificadas (usando `promedio_rating` de MongoDB). Neo4j y MongoDB se complementan en este flujo.

5. **Sincronización incremental**: Neo4j se sincroniza con `MERGE` (idempotente) cada vez que se crea un usuario, una propiedad o una reserva. No necesita estar sincronizado en tiempo real con todas las colecciones de Mongo o tablas de Postgres, solo con los eventos relevantes para el grafo.

### Qué NO hace Neo4j aquí
No es la fuente de verdad para ningún dato del dominio. Es un índice de relaciones derivado a partir de los datos en MongoDB y PostgreSQL. Los atributos completos de usuarios y propiedades siempre se leen desde MongoDB.

---

## Flujo de datos entre bases

```
POST /api/reservas
    │
    ├─ MongoDB    → valida que el huésped y la propiedad existan
    ├─ PostgreSQL → verifica disponibilidad de fechas (transacción ACID)
    │              inserta reserva + pago de forma atómica
    └─ Neo4j      → registra relación RESERVO(huésped → propiedad)

POST /api/resenias
    │
    ├─ PostgreSQL → consulta la reserva para validar estado y existencia
    ├─ Cassandra  → inserta la reseña en las tres tablas (batch)
    └─ MongoDB    → actualiza promedio_rating en propiedad y anfitrión

GET /api/recomendaciones/:id
    │
    ├─ Neo4j      → traversal del grafo → lista de propiedad_id recomendados
    └─ MongoDB    → hidrata cada ID con los datos completos de la propiedad
```
