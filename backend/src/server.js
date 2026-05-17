import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { v4 as uuid } from 'uuid';
import { db } from './data.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
const PORT = process.env.PORT || 3000;

const ok = (res, data) => res.json({ ok: true, data });
const fail = (res, status, message) => res.status(status).json({ ok: false, message });
const findUser = id => db.usuarios.find(u => u.id === id);
const findProp = id => db.propiedades.find(p => p.id === id);
const overlap = (aStart, aEnd, bStart, bEnd) => new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

function recalcRatings(propiedadId, anfitrionId) {
  const propReviews = db.resenias.filter(r => r.propiedad_id === propiedadId);
  const prop = findProp(propiedadId);
  if (prop) prop.promedio_rating = propReviews.length ? +(propReviews.reduce((a,r)=>a+r.calificacion,0)/propReviews.length).toFixed(2) : 0;
  const hostReviews = db.resenias.filter(r => r.anfitrion_id === anfitrionId);
  const host = findUser(anfitrionId);
  if (host) host.promedio_rating = hostReviews.length ? +(hostReviews.reduce((a,r)=>a+r.calificacion,0)/hostReviews.length).toFixed(2) : 0;
}

app.get('/api/health', (_, res) => ok(res, { status: 'running', databases: ['mongo','postgres','cassandra','neo4j'] }));

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
  const { nombre, email, telefono, tipo } = req.body;
  if (!nombre || !email || !tipo) return fail(res, 400, 'Nombre, email y tipo son obligatorios');
  if (!['huesped','anfitrion'].includes(tipo)) return fail(res, 400, 'Tipo inválido');
  const nuevo = { id: uuid(), nombre, email, telefono: telefono || '', tipo, promedio_rating: 0 };
  db.usuarios.push(nuevo); ok(res, nuevo);
});
app.put('/api/usuarios/:id', (req, res) => {
  const user = findUser(req.params.id); if (!user) return fail(res, 404, 'Usuario no encontrado');
  Object.assign(user, req.body, { id: user.id, tipo: user.tipo }); ok(res, user);
});
app.get('/api/usuarios/:id', (req, res) => {
  const user = findUser(req.params.id); if (!user) return fail(res, 404, 'Usuario no encontrado'); ok(res, user);
});
app.get('/api/anfitriones/:id/perfil', (req, res) => {
  const user = findUser(req.params.id); if (!user || user.tipo !== 'anfitrion') return fail(res, 404, 'Anfitrión no encontrado');
  ok(res, { ...user, propiedades: db.propiedades.filter(p => p.anfitrion_id === user.id && p.estado !== 'eliminada') });
});

app.get('/api/propiedades', (req, res) => {
  const { ciudad, tipo, precioMax, lat, lng, radioKm } = req.query;
  let props = db.propiedades.filter(p => p.estado !== 'eliminada');
  if (ciudad) props = props.filter(p => p.ubicacion.ciudad.toLowerCase().includes(ciudad.toLowerCase()));
  if (tipo) props = props.filter(p => p.tipo === tipo);
  if (precioMax) props = props.filter(p => p.precio_noche <= Number(precioMax));
  if (lat && lng && radioKm) {
    const toRad = v => v * Math.PI / 180;
    props = props.filter(p => {
      const [plng, plat] = p.ubicacion.coords.coordinates;
      const R=6371, dLat=toRad(plat-Number(lat)), dLng=toRad(plng-Number(lng));
      const a=Math.sin(dLat/2)**2 + Math.cos(toRad(Number(lat))) * Math.cos(toRad(plat)) * Math.sin(dLng/2)**2;
      return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= Number(radioKm);
    });
  }
  ok(res, props);
});
app.post('/api/propiedades', (req, res) => {
  const a = findUser(req.body.anfitrion_id);
  if (!a || a.tipo !== 'anfitrion') return fail(res, 400, 'Debe indicar un anfitrión válido');
  const required = ['titulo','tipo','ubicacion','precio_noche','cantidad_huespedes'];
  if (required.some(k => req.body[k] === undefined || req.body[k] === '')) return fail(res, 400, 'Faltan datos obligatorios de la propiedad');
  const nueva = { id: uuid(), descripcion: '', servicios: [], estado: 'activa', promedio_rating: 0, ...req.body, precio_noche: Number(req.body.precio_noche), cantidad_huespedes: Number(req.body.cantidad_huespedes) };
  db.propiedades.push(nueva); ok(res, nueva);
});
app.put('/api/propiedades/:id', (req, res) => {
  const prop = findProp(req.params.id); if (!prop) return fail(res, 404, 'Propiedad no encontrada');
  Object.assign(prop, req.body, { id: prop.id, anfitrion_id: prop.anfitrion_id }); ok(res, prop);
});
app.delete('/api/propiedades/:id', (req, res) => {
  const prop = findProp(req.params.id); if (!prop) return fail(res, 404, 'Propiedad no encontrada');
  prop.estado = 'eliminada'; ok(res, prop);
});
app.get('/api/anfitriones/:id/propiedades', (req, res) => ok(res, db.propiedades.filter(p => p.anfitrion_id === req.params.id && p.estado !== 'eliminada')));

app.get('/api/reservas', (req, res) => {
  const { huesped_id, anfitrion_id, estado } = req.query;
  let rs = [...db.reservas];
  if (huesped_id) rs = rs.filter(r => r.huesped_id === huesped_id);
  if (anfitrion_id) rs = rs.filter(r => r.anfitrion_id === anfitrion_id);
  if (estado) rs = rs.filter(r => r.estado === estado);
  ok(res, rs.map(r => ({...r, propiedad: findProp(r.propiedad_id), huesped: findUser(r.huesped_id)})));
});
app.post('/api/reservas', (req, res) => {
  const { huesped_id, propiedad_id, fecha_inicio, fecha_fin, cantidad_huespedes, pago } = req.body;
  const h = findUser(huesped_id), p = findProp(propiedad_id);
  if (!h || h.tipo !== 'huesped') return fail(res, 400, 'Debe indicar un huésped válido');
  if (!p || p.estado !== 'activa') return fail(res, 400, 'Propiedad inválida');
  if (!fecha_inicio || !fecha_fin || new Date(fecha_inicio) >= new Date(fecha_fin)) return fail(res, 400, 'Rango de fechas inválido');
  if (Number(cantidad_huespedes) > p.cantidad_huespedes) return fail(res, 400, 'La cantidad de huéspedes supera la capacidad máxima');
  const busy = db.reservas.some(r => r.propiedad_id === propiedad_id && r.estado !== 'cancelada' && overlap(fecha_inicio, fecha_fin, r.fecha_inicio, r.fecha_fin));
  if (busy) return fail(res, 409, 'La propiedad no está disponible en ese rango de fechas');
  const nights = Math.ceil((new Date(fecha_fin) - new Date(fecha_inicio))/(1000*60*60*24));
  const reserva = { id: uuid(), huesped_id, propiedad_id, anfitrion_id: p.anfitrion_id, fecha_inicio, fecha_fin, cantidad_huespedes: Number(cantidad_huespedes), estado: 'confirmada', pago: { monto: pago?.monto ? Number(pago.monto) : nights * p.precio_noche, metodo: pago?.metodo || 'tarjeta', estado: pago?.estado || 'pendiente' } };
  db.reservas.push(reserva); ok(res, reserva);
});
app.patch('/api/reservas/:id/cancelar', (req, res) => {
  const r = db.reservas.find(x => x.id === req.params.id); if (!r) return fail(res, 404, 'Reserva no encontrada');
  r.estado = 'cancelada'; ok(res, r);
});
app.patch('/api/reservas/:id/finalizar', (req, res) => {
  const r = db.reservas.find(x => x.id === req.params.id); if (!r) return fail(res, 404, 'Reserva no encontrada');
  r.estado = 'completada'; r.pago.estado = 'completado'; ok(res, r);
});
app.get('/api/reservas/:id/pago', (req, res) => {
  const r = db.reservas.find(x => x.id === req.params.id); if (!r) return fail(res, 404, 'Reserva no encontrada'); ok(res, r.pago);
});

app.get('/api/propiedades/:id/resenias', (req, res) => ok(res, db.resenias.filter(r => r.propiedad_id === req.params.id)));
app.post('/api/resenias', (req, res) => {
  const { reserva_id, calificacion, comentario } = req.body;
  const reserva = db.reservas.find(r => r.id === reserva_id);
  if (!reserva) return fail(res, 404, 'Reserva no encontrada');
  if (reserva.estado !== 'completada') return fail(res, 400, 'Solo se puede reseñar una reserva completada');
  if (db.resenias.some(r => r.reserva_id === reserva_id)) return fail(res, 409, 'La reserva ya tiene reseña');
  const review = { id: uuid(), reserva_id, huesped_id: reserva.huesped_id, anfitrion_id: reserva.anfitrion_id, propiedad_id: reserva.propiedad_id, calificacion: Number(calificacion), comentario: comentario || '', fecha: new Date().toISOString().slice(0,10) };
  if (review.calificacion < 1 || review.calificacion > 5) return fail(res, 400, 'La calificación debe estar entre 1 y 5');
  db.resenias.push(review); recalcRatings(review.propiedad_id, review.anfitrion_id); ok(res, review);
});

app.listen(PORT, () => console.log(`API AirBnB TPO escuchando en puerto ${PORT}`));
