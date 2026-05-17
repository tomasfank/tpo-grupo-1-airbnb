import { v4 as uuid } from 'uuid';

const host1 = uuid();
const host2 = uuid();
const guest1 = uuid();
const guest2 = uuid();
const prop1 = uuid();
const prop2 = uuid();
const prop3 = uuid();

export const db = {
  usuarios: [
    { id: host1, nombre: 'Ana Gómez', email: 'ana.host@mail.com', telefono: '1111-2222', tipo: 'anfitrion', promedio_rating: 4.5 },
    { id: host2, nombre: 'Carlos Pérez', email: 'carlos.host@mail.com', telefono: '3333-4444', tipo: 'anfitrion', promedio_rating: 0 },
    { id: guest1, nombre: 'Lucía Fernández', email: 'lucia@mail.com', telefono: '5555-6666', tipo: 'huesped', promedio_rating: 0 },
    { id: guest2, nombre: 'Martín Silva', email: 'martin@mail.com', telefono: '7777-8888', tipo: 'huesped', promedio_rating: 0 }
  ],
  propiedades: [
    { id: prop1, anfitrion_id: host1, titulo: 'Depto luminoso en Palermo', tipo: 'departamento', ubicacion: { ciudad: 'Buenos Aires', pais: 'Argentina', direccion: 'Av. Santa Fe 3200', coords: { type: 'Point', coordinates: [-58.421, -34.589] } }, precio_noche: 60000, descripcion: 'Cerca de bares y subte.', cantidad_huespedes: 3, servicios: ['wifi','aire acondicionado'], estado: 'activa', promedio_rating: 4.5 },
    { id: prop2, anfitrion_id: host1, titulo: 'Casa con patio en Córdoba', tipo: 'casa', ubicacion: { ciudad: 'Córdoba', pais: 'Argentina', direccion: 'Belgrano 120', coords: { type: 'Point', coordinates: [-64.188, -31.42] } }, precio_noche: 80000, descripcion: 'Ideal familia.', cantidad_huespedes: 5, servicios: ['wifi','estacionamiento','pileta'], estado: 'activa', promedio_rating: 0 },
    { id: prop3, anfitrion_id: host2, titulo: 'Loft céntrico en Rosario', tipo: 'loft', ubicacion: { ciudad: 'Rosario', pais: 'Argentina', direccion: 'Pellegrini 900', coords: { type: 'Point', coordinates: [-60.64, -32.95] } }, precio_noche: 45000, descripcion: 'Funcional y moderno.', cantidad_huespedes: 2, servicios: ['wifi'], estado: 'activa', promedio_rating: 0 }
  ],
  reservas: [],
  resenias: []
};
