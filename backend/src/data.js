// UUIDs fijos para que las referencias en Postgres sobrevivan reinicios
export const SEED_IDS = {
  admin:  '00000000-0000-0000-0000-000000000001',
  host1:  '11111111-0001-0001-0001-000000000001',
  host2:  '11111111-0002-0001-0001-000000000002',
  guest1: '22222222-0001-0001-0001-000000000001',
  guest2: '22222222-0002-0001-0001-000000000002',
  prop1:  '33333333-0001-0001-0001-000000000001',
  prop2:  '33333333-0002-0001-0001-000000000002',
  prop3:  '33333333-0003-0001-0001-000000000003',
};

export const SEED_USUARIOS = [
  { id: SEED_IDS.admin,  nombre: 'Admin TPO',         email: 'admin@mail.com',       telefono: '0000-0000', tipo: 'admin',     bio: 'Administrador del sistema.',             promedio_rating: 0,   created_at: '2025-01-01T00:00:00.000Z' },
  { id: SEED_IDS.host1,  nombre: 'Ana Gómez',         email: 'ana.host@mail.com',    telefono: '1111-2222', tipo: 'anfitrion', bio: 'Host con foco en estadías urbanas.',      promedio_rating: 4.5, created_at: '2025-01-01T00:00:00.000Z' },
  { id: SEED_IDS.host2,  nombre: 'Carlos Pérez',      email: 'carlos.host@mail.com', telefono: '3333-4444', tipo: 'anfitrion', bio: 'Administra alojamientos familiares.',     promedio_rating: 0,   created_at: '2025-01-01T00:00:00.000Z' },
  { id: SEED_IDS.guest1, nombre: 'Lucía Fernández',   email: 'lucia@mail.com',       telefono: '5555-6666', tipo: 'huesped',   bio: 'Viaja por trabajo y escapadas.',         promedio_rating: 0,   created_at: '2025-01-01T00:00:00.000Z' },
  { id: SEED_IDS.guest2, nombre: 'Martín Silva',      email: 'martin@mail.com',      telefono: '7777-8888', tipo: 'huesped',   bio: 'Busca alojamientos tranquilos.',         promedio_rating: 0,   created_at: '2025-01-01T00:00:00.000Z' },
];

export const SEED_PROPIEDADES = [
  {
    id: SEED_IDS.prop1, anfitrion_id: SEED_IDS.host1,
    titulo: 'Depto luminoso en Palermo', tipo: 'departamento',
    ubicacion: { ciudad: 'Buenos Aires', pais: 'Argentina', direccion: 'Av. Santa Fe 3200', coords: { type: 'Point', coordinates: [-58.421, -34.589] } },
    precio_noche: 60000, descripcion: 'Cerca de bares, subte y zona gastronómica.',
    cantidad_huespedes: 3, servicios: ['wifi', 'aire acondicionado', 'cocina'],
    estado: 'activa', promedio_rating: 4.5,
    imagen: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: SEED_IDS.prop2, anfitrion_id: SEED_IDS.host1,
    titulo: 'Casa con patio en Córdoba', tipo: 'casa',
    ubicacion: { ciudad: 'Córdoba', pais: 'Argentina', direccion: 'Belgrano 120', coords: { type: 'Point', coordinates: [-64.188, -31.42] } },
    precio_noche: 80000, descripcion: 'Ideal para familia, con patio y parrilla.',
    cantidad_huespedes: 5, servicios: ['wifi', 'estacionamiento', 'pileta', 'parrilla'],
    estado: 'activa', promedio_rating: 0,
    imagen: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: SEED_IDS.prop3, anfitrion_id: SEED_IDS.host2,
    titulo: 'Loft céntrico en Rosario', tipo: 'loft',
    ubicacion: { ciudad: 'Rosario', pais: 'Argentina', direccion: 'Pellegrini 900', coords: { type: 'Point', coordinates: [-60.64, -32.95] } },
    precio_noche: 45000, descripcion: 'Funcional, moderno y cerca del río.',
    cantidad_huespedes: 2, servicios: ['wifi', 'calefacción'],
    estado: 'activa', promedio_rating: 0,
    imagen: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  },
];
