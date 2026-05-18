import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { v4 as uuid } from 'uuid';
import { db } from './data.js';
import { ok, fail, findUser, findProp, overlap, nightsBetween, hydrateReserva, distanceKm, recalcRatings } from './utils.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
const PORT = process.env.PORT || 3000;

app.get('/api/health', (_, res) => ok(res, { status: 'running', mode: 'memory', databases: ['mongo','postgres','cassandra','neo4j'] }));
app.get('/api/dashboard', (_, res) => ok(res, {
  usuarios: db.usuarios.length,
  anfitriones: db.usuarios.filter(u=>u.tipo==='anfitrion').length,
  huespedes: db.usuarios.filter(u=>u.tipo==='huesped').length,
  propiedades: db.propiedades.filter(p=>p.estado==='activa').length,
  reservas: db.reservas.length,
  reservasActivas: db.reservas.filter(r=>r.estado==='confirmada').length,
  resenias: db.resenias.length
}));
app.post('/api/auth/login-simulado', (req, res) => {
  const user = findUser(req.body.usuario_id);
  if (!user) return fail(res, 404, 'Usuario no encontrado');
  ok(res, user);
});

app.get('/api/usuarios', (req, res) => {
  const { tipo } = req.query;
  ok(res, tipo ? db.usuarios.filter(u => u.tipo === tipo) : db.usuarios);
});
app.post('/api/usuarios', (req, res) => {
  const { nombre, email, telefono, tipo, bio } = req.body;
  if (!nombre || !email || !tipo) return fail(res, 400, 'nombre, email y tipo son obligatorios');
  if (!['huesped','anfitrion'].includes(tipo)) return fail(res, 400, 'tipo debe ser huesped o anfitrion');
  const user = { id: uuid(), nombre, email, telefono: telefono || '', tipo, bio: bio || '', promedio_rating: 0, created_at: new Date().toISOString() };
  db.usuarios.push(user);
  ok(res, user, 201);
});
app.get('/api/usuarios/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return fail(res, 404, 'Usuario no encontrado');
  const propiedades = db.propiedades.filter(p => p.anfitrion_id === user.id && p.estado !== 'eliminada');
  ok(res, { ...user, propiedades });
});
app.put('/api/usuarios/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return fail(res, 404, 'Usuario no encontrado');
  Object.assign(user, req.body, { id: user.id, tipo: user.tipo });
  ok(res, user);
});

app.get('/api/propiedades', (req, res) => {
  let result = db.propiedades.filter(p => p.estado !== 'eliminada');
  const { ciudad, tipo, precioMax, precioMin, anfitrion_id, lat, lng, radioKm } = req.query;
  if (ciudad) result = result.filter(p => p.ubicacion.ciudad.toLowerCase().includes(String(ciudad).toLowerCase()));
  if (tipo) result = result.filter(p => p.tipo === tipo);
  if (anfitrion_id) result = result.filter(p => p.anfitrion_id === anfitrion_id);
  if (precioMin) result = result.filter(p => Number(p.precio_noche) >= Number(precioMin));
  if (precioMax) result = result.filter(p => Number(p.precio_noche) <= Number(precioMax));
  if (lat && lng && radioKm) result = result.filter(p => distanceKm(Number(lat), Number(lng), p.ubicacion.coords.coordinates[1], p.ubicacion.coords.coordinates[0]) <= Number(radioKm));
  ok(res, result.map(p => ({ ...p, anfitrion: findUser(p.anfitrion_id) })));
});
app.post('/api/propiedades', (req, res) => {
  const anfitrion = findUser(req.body.anfitrion_id);
  if (!anfitrion || anfitrion.tipo !== 'anfitrion') return fail(res, 400, 'Debe indicar un anfitrión válido');
  const { titulo, tipo, ubicacion, precio_noche, cantidad_huespedes } = req.body;
  if (!titulo || !tipo || !ubicacion?.ciudad || !precio_noche || !cantidad_huespedes) return fail(res, 400, 'Faltan datos obligatorios de propiedad');
  const prop = { id: uuid(), ...req.body, precio_noche: Number(precio_noche), cantidad_huespedes: Number(cantidad_huespedes), estado: 'activa', promedio_rating: 0, servicios: req.body.servicios || [], imagen: req.body.imagen || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80' };
  db.propiedades.push(prop);
  ok(res, prop, 201);
});
app.get('/api/propiedades/:id', (req, res) => {
  const prop = findProp(req.params.id);
  if (!prop) return fail(res, 404, 'Propiedad no encontrada');
  ok(res, { ...prop, anfitrion: findUser(prop.anfitrion_id), resenias: db.resenias.filter(r=>r.propiedad_id===prop.id) });
});
app.put('/api/propiedades/:id', (req, res) => {
  const prop = findProp(req.params.id);
  if (!prop) return fail(res, 404, 'Propiedad no encontrada');
  Object.assign(prop, req.body, { id: prop.id, anfitrion_id: prop.anfitrion_id });
  if (req.body.precio_noche) prop.precio_noche = Number(req.body.precio_noche);
  if (req.body.cantidad_huespedes) prop.cantidad_huespedes = Number(req.body.cantidad_huespedes);
  ok(res, prop);
});
app.delete('/api/propiedades/:id', (req, res) => {
  const prop = findProp(req.params.id);
  if (!prop) return fail(res, 404, 'Propiedad no encontrada');
  prop.estado = 'eliminada';
  ok(res, prop);
});
app.get('/api/propiedades/:id/resenias', (req, res) => ok(res, db.resenias.filter(r => r.propiedad_id === req.params.id)));

app.get('/api/reservas', (req, res) => {
  const { huesped_id, anfitrion_id, propiedad_id, estado } = req.query;
  let result = db.reservas;
  if (huesped_id) result = result.filter(r => r.huesped_id === huesped_id);
  if (anfitrion_id) result = result.filter(r => r.anfitrion_id === anfitrion_id);
  if (propiedad_id) result = result.filter(r => r.propiedad_id === propiedad_id);
  if (estado) result = result.filter(r => r.estado === estado);
  ok(res, result.map(hydrateReserva));
});
app.post('/api/reservas', (req, res) => {
  const { huesped_id, propiedad_id, fecha_inicio, fecha_fin, cantidad_huespedes, pago } = req.body;
  const huesped = findUser(huesped_id); const prop = findProp(propiedad_id);
  if (!huesped || huesped.tipo !== 'huesped') return fail(res, 400, 'Debe indicar un huésped válido');
  if (!prop || prop.estado !== 'activa') return fail(res, 400, 'Propiedad no disponible');
  if (!fecha_inicio || !fecha_fin || new Date(fecha_inicio) >= new Date(fecha_fin)) return fail(res, 400, 'Rango de fechas inválido');
  if (Number(cantidad_huespedes) > Number(prop.cantidad_huespedes)) return fail(res, 400, 'La cantidad de huéspedes supera la capacidad máxima');
  const ocupada = db.reservas.some(r => r.propiedad_id === propiedad_id && r.estado === 'confirmada' && overlap(fecha_inicio, fecha_fin, r.fecha_inicio, r.fecha_fin));
  if (ocupada) return fail(res, 409, 'La propiedad no está disponible en ese rango');
  const noches = nightsBetween(fecha_inicio, fecha_fin);
  const monto = noches * Number(prop.precio_noche);
  const reserva = { id: uuid(), huesped_id, anfitrion_id: prop.anfitrion_id, propiedad_id, fecha_inicio, fecha_fin, cantidad_huespedes: Number(cantidad_huespedes), estado: 'confirmada', pago: { monto, metodo: pago?.metodo || 'tarjeta', estado: pago?.estado || 'pendiente' }, created_at: new Date().toISOString() };
  db.reservas.push(reserva);
  ok(res, hydrateReserva(reserva), 201);
});
app.patch('/api/reservas/:id/cancelar', (req, res) => {
  const reserva = db.reservas.find(r => r.id === req.params.id);
  if (!reserva) return fail(res, 404, 'Reserva no encontrada');
  reserva.estado = 'cancelada';
  ok(res, hydrateReserva(reserva));
});
app.patch('/api/reservas/:id/finalizar', (req, res) => {
  const reserva = db.reservas.find(r => r.id === req.params.id);
  if (!reserva) return fail(res, 404, 'Reserva no encontrada');
  reserva.estado = 'completada'; reserva.pago.estado = 'completado';
  ok(res, hydrateReserva(reserva));
});
app.patch('/api/reservas/:id/pago', (req, res) => {
  const reserva = db.reservas.find(r => r.id === req.params.id);
  if (!reserva) return fail(res, 404, 'Reserva no encontrada');
  reserva.pago.estado = req.body.estado || reserva.pago.estado;
  reserva.pago.metodo = req.body.metodo || reserva.pago.metodo;
  ok(res, hydrateReserva(reserva));
});

app.post('/api/resenias', (req, res) => {
  const { reserva_id, calificacion, comentario } = req.body;
  const reserva = db.reservas.find(r => r.id === reserva_id);
  if (!reserva) return fail(res, 404, 'Reserva no encontrada');
  if (reserva.estado !== 'completada') return fail(res, 400, 'Solo se puede reseñar una reserva completada');
  if (db.resenias.some(r => r.reserva_id === reserva_id)) return fail(res, 409, 'La reserva ya tiene reseña');
  const score = Number(calificacion);
  if (score < 1 || score > 5) return fail(res, 400, 'La calificación debe estar entre 1 y 5');
  const resenia = { id: uuid(), reserva_id, propiedad_id: reserva.propiedad_id, huesped_id: reserva.huesped_id, anfitrion_id: reserva.anfitrion_id, calificacion: score, comentario: comentario || '', created_at: new Date().toISOString() };
  db.resenias.push(resenia); recalcRatings(reserva.propiedad_id, reserva.anfitrion_id);
  ok(res, resenia, 201);
});
app.get('/api/resenias', (_, res) => ok(res, db.resenias));

app.use((_, res) => fail(res, 404, 'Endpoint no encontrado'));
app.listen(PORT, () => console.log(`Airbnb TPO API running on port ${PORT}`));
