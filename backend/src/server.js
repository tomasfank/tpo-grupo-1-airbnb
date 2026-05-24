import express from 'express';
import cors    from 'cors';
import morgan  from 'morgan';
import bcrypt  from 'bcryptjs';
import { v4 as uuid } from 'uuid';

import { ok, fail, nightsBetween } from './utils.js';
import { pool, initPostgres, mapReserva, getReservaById } from './postgres.js';
import {
  initMongo, getUsuarios, getUserById, getUserByEmail, createUsuario, updateUsuario, deleteUsuario,
  getPropiedades, getPropiedadById, createPropiedad, updatePropiedad,
  recalcRatings, cacheResenia, getDashboardMongo,
} from './mongo.js';
import {
  initCassandra, createResenia, getReseniasByPropiedad,
  getReseniasByAnfitrion, getResenias, existeReseniaParaReserva,
} from './cassandra.js';
import {
  initNeo4j, syncUsuario, syncPropiedad, syncReserva,
  getRecomendaciones, seedNeo4j,
} from './neo4j.js';
import { SEED_USUARIOS, SEED_PROPIEDADES } from './data.js';

const app  = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
const PORT = process.env.PORT || 3000;

// ── Inicialización de todas las bases ────────────────────────────────────────
await initPostgres();
await initMongo();
await initCassandra();
await initNeo4j();
await seedNeo4j(SEED_USUARIOS, SEED_PROPIEDADES);

// ── Helpers locales ───────────────────────────────────────────────────────────

async function hydrateReserva(reserva) {
  const [huesped, anfitrion, propiedad] = await Promise.all([
    getUserById(reserva.huesped_id),
    getUserById(reserva.anfitrion_id),
    getPropiedadById(reserva.propiedad_id),
  ]);
  const resenia = await existeReseniaParaReserva(reserva.id)
    ? (await getReseniasByPropiedad(reserva.propiedad_id)).find(r => r.reserva_id === reserva.id) || null
    : null;
  return { ...reserva, huesped, anfitrion, propiedad, resenia };
}

// ── Health / Dashboard ────────────────────────────────────────────────────────

app.get('/api/health', (_, res) =>
  ok(res, { status: 'running', mode: 'multi-db', databases: ['mongodb', 'postgres', 'cassandra', 'neo4j'] })
);

app.get('/api/dashboard', async (_, res) => {
  const [mongo, reservasRows, resenias] = await Promise.all([
    getDashboardMongo(),
    pool.query(`SELECT estado FROM reservas`),
    getResenias(),
  ]);
  ok(res, {
    usuarios:        mongo.totalUsuarios,
    anfitriones:     mongo.anfitriones,
    huespedes:       mongo.huespedes,
    propiedades:     mongo.totalProps,
    reservas:        reservasRows.rows.length,
    reservasActivas: reservasRows.rows.filter(r => r.estado === 'confirmada').length,
    resenias:        resenias.length,
  });
});

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login-simulado', async (req, res) => {
  const user = await getUserById(req.body.usuario_id);
  if (!user) return fail(res, 404, 'Usuario no encontrado');
  ok(res, user);
});

app.post('/api/auth/register', async (req, res) => {
  const { nombre, email, password, tipo, telefono, bio } = req.body;
  if (!nombre || !email || !password || !tipo)
    return fail(res, 400, 'nombre, email, password y tipo son obligatorios');
  if (!['huesped', 'anfitrion'].includes(tipo))
    return fail(res, 400, 'tipo debe ser huesped o anfitrion');
  if (password.length < 6)
    return fail(res, 400, 'La contraseña debe tener al menos 6 caracteres');

  const existing = await getUserByEmail(email);
  if (existing) return fail(res, 409, 'El email ya está registrado');

  const password_hash = await bcrypt.hash(password, 10);
  const doc = {
    id: uuid(), nombre, email,
    telefono: telefono || '', tipo,
    bio: bio || '', promedio_rating: 0,
    password_hash,
    created_at: new Date().toISOString(),
  };
  await createUsuario(doc);
  const user = await getUserById(doc.id);
  await syncUsuario(user);
  ok(res, user, 201);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return fail(res, 400, 'Email y contraseña son obligatorios');

  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) return fail(res, 401, 'Credenciales inválidas');

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return fail(res, 401, 'Credenciales inválidas');

  const { password_hash, ...safe } = user;
  ok(res, safe);
});

// ── Usuarios (MongoDB) ────────────────────────────────────────────────────────

app.get('/api/usuarios', async (req, res) => {
  const filtro = req.query.tipo ? { tipo: req.query.tipo } : {};
  ok(res, await getUsuarios(filtro));
});

app.post('/api/usuarios', async (req, res) => {
  const { nombre, email, password, telefono, tipo, bio } = req.body;
  if (!nombre || !email || !tipo) return fail(res, 400, 'nombre, email y tipo son obligatorios');
  if (!['huesped', 'anfitrion', 'admin'].includes(tipo)) return fail(res, 400, 'tipo debe ser huesped, anfitrion o admin');
  const existing = await getUserByEmail(email);
  if (existing) return fail(res, 409, 'El email ya está registrado');
  const doc = {
    id: uuid(), nombre, email,
    telefono: telefono || '', tipo,
    bio: bio || '', promedio_rating: 0,
    password_hash: password ? await bcrypt.hash(password, 10) : null,
    created_at: new Date().toISOString(),
  };
  const user = await createUsuario(doc);
  await syncUsuario(user);
  ok(res, user, 201);
});

app.get('/api/usuarios/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) return fail(res, 404, 'Usuario no encontrado');
  const propiedades = await getPropiedades({ anfitrion_id: user.id });
  ok(res, { ...user, propiedades });
});

app.put('/api/usuarios/:id', async (req, res) => {
  const exists = await getUserById(req.params.id);
  if (!exists) return fail(res, 404, 'Usuario no encontrado');
  const patch = { ...req.body };
  delete patch.id; delete patch.tipo;
  const updated = await updateUsuario(req.params.id, patch);
  await syncUsuario(updated);
  ok(res, updated);
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const exists = await getUserById(req.params.id);
  if (!exists) return fail(res, 404, 'Usuario no encontrado');
  await deleteUsuario(req.params.id);
  ok(res, { id: req.params.id });
});

// ── Propiedades (MongoDB) ─────────────────────────────────────────────────────

app.get('/api/propiedades', async (req, res) => {
  const { ciudad, tipo, precioMax, precioMin, anfitrion_id, lat, lng, radioKm } = req.query;
  const props = await getPropiedades({ ciudad, tipo, precioMax, precioMin, anfitrion_id, lat, lng, radioKm });
  const result = await Promise.all(
    props.map(async p => ({ ...p, anfitrion: await getUserById(p.anfitrion_id) }))
  );
  ok(res, result);
});

app.post('/api/propiedades', async (req, res) => {
  const anfitrion = await getUserById(req.body.anfitrion_id);
  if (!anfitrion || anfitrion.tipo !== 'anfitrion') return fail(res, 400, 'Debe indicar un anfitrión válido');
  const { titulo, tipo, ubicacion, precio_noche, cantidad_huespedes } = req.body;
  if (!titulo || !tipo || !ubicacion?.ciudad || !precio_noche || !cantidad_huespedes)
    return fail(res, 400, 'Faltan datos obligatorios de propiedad');
  const doc = {
    ...req.body,
    id: uuid(),
    precio_noche: Number(precio_noche),
    cantidad_huespedes: Number(cantidad_huespedes),
    estado: 'activa',
    promedio_rating: 0,
    servicios: req.body.servicios || [],
    imagen: req.body.imagen || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=80',
  };
  const prop = await createPropiedad(doc);
  await syncPropiedad(prop);
  ok(res, prop, 201);
});   

app.get('/api/propiedades/:id', async (req, res) => {
  const prop = await getPropiedadById(req.params.id);
  if (!prop) return fail(res, 404, 'Propiedad no encontrada');
  const [anfitrion, resenias] = await Promise.all([
    getUserById(prop.anfitrion_id),
    getReseniasByPropiedad(req.params.id),
  ]);
  ok(res, { ...prop, anfitrion, resenias });
});

app.put('/api/propiedades/:id', async (req, res) => {
  const exists = await getPropiedadById(req.params.id);
  if (!exists) return fail(res, 404, 'Propiedad no encontrada');
  const patch = { ...req.body };
  delete patch.id; delete patch.anfitrion_id;
  if (patch.precio_noche) patch.precio_noche = Number(patch.precio_noche);
  if (patch.cantidad_huespedes) patch.cantidad_huespedes = Number(patch.cantidad_huespedes);
  const updated = await updatePropiedad(req.params.id, patch);
  ok(res, updated);
});

app.delete('/api/propiedades/:id', async (req, res) => {
  const exists = await getPropiedadById(req.params.id);
  if (!exists) return fail(res, 404, 'Propiedad no encontrada');
  const updated = await updatePropiedad(req.params.id, { estado: 'eliminada' });
  ok(res, updated);
});

app.get('/api/propiedades/:id/resenias', async (req, res) =>
  ok(res, await getReseniasByPropiedad(req.params.id))
);

// ── Reservas (PostgreSQL) ─────────────────────────────────────────────────────

app.get('/api/reservas', async (req, res) => {
  const { huesped_id, anfitrion_id, propiedad_id, estado } = req.query;
  const conditions = [];
  const values = [];

  if (huesped_id)    { values.push(huesped_id);    conditions.push(`r.huesped_id = $${values.length}`); }
  if (anfitrion_id)  { values.push(anfitrion_id);   conditions.push(`r.anfitrion_id = $${values.length}`); }
  if (propiedad_id)  { values.push(propiedad_id);   conditions.push(`r.propiedad_id = $${values.length}`); }
  if (estado)        { values.push(estado);          conditions.push(`r.estado = $${values.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`
    SELECT r.*, p.id AS pago_id, p.monto, p.metodo, p.estado AS pago_estado
    FROM reservas r
    JOIN pagos p ON p.reserva_id = r.id
    ${where}
    ORDER BY r.created_at DESC
  `, values);

  const hydrated = await Promise.all(rows.map(row => hydrateReserva(mapReserva(row))));
  ok(res, hydrated);
});

app.post('/api/reservas', async (req, res) => {
  const { huesped_id, propiedad_id, fecha_inicio, fecha_fin, cantidad_huespedes, pago } = req.body;

  const [huesped, prop] = await Promise.all([
    getUserById(huesped_id),
    getPropiedadById(propiedad_id),
  ]);

  if (!huesped || huesped.tipo !== 'huesped') return fail(res, 400, 'Debe indicar un huésped válido');
  if (!prop || prop.estado !== 'activa') return fail(res, 400, 'Propiedad no disponible');
  if (!fecha_inicio || !fecha_fin || new Date(fecha_inicio) >= new Date(fecha_fin))
    return fail(res, 400, 'Rango de fechas inválido');
  if (Number(cantidad_huespedes) > Number(prop.cantidad_huespedes))
    return fail(res, 400, 'La cantidad de huéspedes supera la capacidad máxima');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ocupadas = await client.query(`
      SELECT id FROM reservas
      WHERE propiedad_id = $1 AND estado = 'confirmada'
        AND fecha_inicio < $3 AND fecha_fin > $2
      LIMIT 1
    `, [propiedad_id, fecha_inicio, fecha_fin]);

    if (ocupadas.rows.length) {
      await client.query('ROLLBACK');
      return fail(res, 409, 'La propiedad no está disponible en ese rango');
    }

    const noches    = nightsBetween(fecha_inicio, fecha_fin);
    const monto     = noches * Number(prop.precio_noche);
    const reservaId = uuid();
    const pagoId    = uuid();

    await client.query(`
      INSERT INTO reservas (id, huesped_id, anfitrion_id, propiedad_id, fecha_inicio, fecha_fin, cantidad_huespedes, estado)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [reservaId, huesped_id, prop.anfitrion_id, propiedad_id, fecha_inicio, fecha_fin, Number(cantidad_huespedes), 'confirmada']);

    await client.query(`
      INSERT INTO pagos (id, reserva_id, monto, metodo, estado)
      VALUES ($1,$2,$3,$4,$5)
    `, [pagoId, reservaId, monto, pago?.metodo || 'tarjeta', pago?.estado || 'pendiente']);

    await client.query('COMMIT');

    const reserva = await getReservaById(reservaId);
    // Registrar relación en Neo4j
    await syncReserva({ huesped_id, propiedad_id });
    ok(res, await hydrateReserva(reserva), 201);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    fail(res, 500, 'Error al crear la reserva');
  } finally {
    client.release();
  }
});

app.patch('/api/reservas/:id/cancelar', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE reservas SET estado = 'cancelada' WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!rows.length) return fail(res, 404, 'Reserva no encontrada');
  ok(res, await hydrateReserva(await getReservaById(req.params.id)));
});

app.patch('/api/reservas/:id/finalizar', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE reservas SET estado = 'completada' WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!updated.rows.length) {
      await client.query('ROLLBACK');
      return fail(res, 404, 'Reserva no encontrada');
    }
    await client.query(`UPDATE pagos SET estado = 'completado' WHERE reserva_id = $1`, [req.params.id]);
    await client.query('COMMIT');
    ok(res, await hydrateReserva(await getReservaById(req.params.id)));
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    fail(res, 500, 'Error al finalizar la reserva');
  } finally {
    client.release();
  }
});

app.patch('/api/reservas/:id/pago', async (req, res) => {
  const reserva = await getReservaById(req.params.id);
  if (!reserva) return fail(res, 404, 'Reserva no encontrada');
  await pool.query(
    `UPDATE pagos SET estado = $1, metodo = $2 WHERE reserva_id = $3`,
    [req.body.estado || reserva.pago.estado, req.body.metodo || reserva.pago.metodo, req.params.id]
  );
  ok(res, await hydrateReserva(await getReservaById(req.params.id)));
});

// ── Reseñas (Cassandra) ───────────────────────────────────────────────────────

app.post('/api/resenias', async (req, res) => {
  const { reserva_id, calificacion, comentario } = req.body;
  const reserva = await getReservaById(reserva_id);
  if (!reserva) return fail(res, 404, 'Reserva no encontrada');
  if (reserva.estado !== 'completada') return fail(res, 400, 'Solo se puede reseñar una reserva completada');
  if (await existeReseniaParaReserva(reserva_id)) return fail(res, 409, 'La reserva ya tiene reseña');
  const score = Number(calificacion);
  if (score < 1 || score > 5) return fail(res, 400, 'La calificación debe estar entre 1 y 5');

  const doc = {
    id: uuid(),
    reserva_id,
    propiedad_id: reserva.propiedad_id,
    huesped_id:   reserva.huesped_id,
    anfitrion_id: reserva.anfitrion_id,
    calificacion: score,
    comentario:   comentario || '',
    created_at:   new Date().toISOString(),
  };

  await createResenia(doc);
  // Cache en Mongo para recalcular promedios eficientemente
  await cacheResenia(doc);
  await recalcRatings(reserva.propiedad_id, reserva.anfitrion_id);
  ok(res, doc, 201);
});

app.get('/api/resenias', async (_, res) => ok(res, await getResenias()));

app.get('/api/resenias/anfitrion/:id', async (req, res) =>
  ok(res, await getReseniasByAnfitrion(req.params.id))
);

// ── Recomendaciones (Neo4j) ───────────────────────────────────────────────────

app.get('/api/recomendaciones/:id', async (req, res) => {
  const usuario_id = req.params.id;
  const user = await getUserById(usuario_id);
  if (!user) return fail(res, 404, 'Usuario no encontrado');

  // Propiedades que el usuario ya reservó (para excluirlas en cualquier caso)
  const { rows: yaReservadas } = await pool.query(
    'SELECT DISTINCT propiedad_id FROM reservas WHERE huesped_id = $1',
    [usuario_id]
  );
  const yaReservadasIds = new Set(yaReservadas.map(r => r.propiedad_id));

  let propIds = await getRecomendaciones(usuario_id);

  // Fallback: si no hay historial colaborativo, recomendar las mejor calificadas
  // excluyendo propiedades que el usuario ya reservó
  if (!propIds.length) {
    const todas = await getPropiedades({});
    propIds = todas
      .filter(p => !yaReservadasIds.has(p.id))
      .sort((a, b) => b.promedio_rating - a.promedio_rating)
      .slice(0, 5)
      .map(p => p.id);
  }

  // Enriquecer con datos completos desde MongoDB
  const propiedades = await Promise.all(
    propIds.map(async id => {
      const p = await getPropiedadById(id);
      if (!p) return null;
      return { ...p, anfitrion: await getUserById(p.anfitrion_id) };
    })
  );

  ok(res, propiedades.filter(Boolean));
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_, res) => fail(res, 404, 'Endpoint no encontrado'));
app.listen(PORT, () => console.log(`Airbnb TPO API running on port ${PORT}`));
