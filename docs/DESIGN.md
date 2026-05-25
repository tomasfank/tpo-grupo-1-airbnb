# Decisiones de diseño
- `pago` se embebe dentro de la reserva por ser una relación uno a uno y consultarse siempre junto a ella.
- `ubicacion` se embebe dentro de la propiedad por ser un subdocumento propio de cada propiedad.
- `servicios` se modela como array de strings dentro de la propiedad, sin colección separada, por ser valores simples que siempre se consultan junto a la propiedad.
- `reseñas` se modela como colección separada, a pesar de la relación uno a uno con reservas, porque el enunciado requiere consultar reseñas por propiedad y calcular promedios frecuentemente.
- `promedio_rating` se guarda precalculado tanto en `usuarios` como en `propiedades` para evitar recalcular en cada consulta.
- `huesped_id` y `anfitrion_id` se incluyen en `reservas` como desnormalización intencional para poder consultar todas las reservas de un huésped o anfitrión directamente sin pasar por otras colecciones.
- `huesped_id` y `anfitrion_id` se incluyen en `reseñas` como desnormalización intencional para calcular promedios y consultar reseñas sin necesidad de pasar por reservas o propiedades.
- `propiedad_id` también se incluye en `reseñas` como desnormalización intencional para consultar reseñas de una propiedad y calcular su promedio directamente sin pasar por reservas.
- `cantidad_huespedes` se incluye tanto en `propiedades` para indicar el máximo permitido, como en `reservas` para registrar cuántos huéspedes tendrá la estadía.