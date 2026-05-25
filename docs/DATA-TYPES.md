# Especificaciones de tipos de datos

## ubicacion {} — subdocumento

```
{
    ciudad: String
    pais: String
    direccion: String
    coords: { type: "Point", coordinates: [longitud, latitud] }
}
```

## pago {} — subdocumento

```
{
    monto: Number
    metodo: String — enum: "tarjeta" | "transferencia" | "efectivo"
    estado: String — enum: "pendiente" | "completado" | "rechazado"
}
```

## servicios — array de strings

Ejemplo:

```
[
    "wifi",
    "pileta",
    "aire acondicionado",
    "estacionamiento"
]
```
