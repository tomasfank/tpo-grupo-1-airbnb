import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { SEED_USUARIOS, SEED_PROPIEDADES } from './data.js';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/airbnb_tpo';
const SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'demo1234';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PUBLIC_USER_PROJECTION = { _id: 0, password_hash: 0 };

let _db = null;

export function getDb() {
  if (!_db) throw new Error('MongoDB no inicializado');
  return _db;
}

export async function initMongo(retries = 20) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = new MongoClient(MONGO_URL);
      await client.connect();
      _db = client.db();

      // Índice 2dsphere para búsqueda geoespacial en propiedades
      await _db.collection('propiedades').createIndex({ 'ubicacion.coords': '2dsphere' });
      // Índices únicos sobre el campo id (UUID string, no _id de Mongo)
      await _db.collection('usuarios').createIndex({ id: 1 }, { unique: true });
      await _db.collection('usuarios').createIndex({ email: 1 }, { unique: true });
      await _db.collection('propiedades').createIndex({ id: 1 }, { unique: true });
      await _db.collection('propiedades').createIndex({ anfitrion_id: 1 });
      // Índices para recalcular promedios de rating eficientemente
      await _db.collection('resenias_cache').createIndex({ propiedad_id: 1 });
      await _db.collection('resenias_cache').createIndex({ anfitrion_id: 1 });
      await _db.collection('resenias_cache').createIndex({ reserva_id: 1 });

      // Password hasheado para los usuarios de seed (permite login real con "demo1234")
      const defaultHash = await bcrypt.hash(SEED_DEFAULT_PASSWORD, 10);

      // Seed: insertar solo si no existen (upsert por id)
      for (const u of SEED_USUARIOS) {
        await _db.collection('usuarios').updateOne(
          { id: u.id },
          { $setOnInsert: { ...u, password_hash: defaultHash } },
          { upsert: true }
        );
        // Si el seed ya existía sin password_hash (carga previa), agregarlo
        await _db.collection('usuarios').updateOne(
          { id: u.id, password_hash: { $exists: false } },
          { $set: { password_hash: defaultHash } }
        );
      }
      for (const p of SEED_PROPIEDADES) {
        await _db.collection('propiedades').updateOne({ id: p.id }, { $setOnInsert: p }, { upsert: true });
      }

      console.log('MongoDB inicializado correctamente');
      return;
    } catch (error) {
      console.log(`MongoDB no disponible todavía. Reintento ${attempt}/${retries}`);
      if (attempt === retries) throw error;
      await sleep(1500);
    }
  }
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export function getUsuarios(filtro = {}) {
  return getDb().collection('usuarios').find(filtro, { projection: PUBLIC_USER_PROJECTION }).toArray();
}

export function getUserById(id) {
  return getDb().collection('usuarios').findOne({ id }, { projection: PUBLIC_USER_PROJECTION });
}

// Devuelve el doc completo INCLUYENDO password_hash. Sólo usar en flows de auth.
export function getUserByEmail(email) {
  return getDb().collection('usuarios').findOne({ email }, { projection: { _id: 0 } });
}

export async function createUsuario(doc) {
  await getDb().collection('usuarios').insertOne(doc);
  return getUserById(doc.id);
}

export async function updateUsuario(id, patch) {
  return getDb().collection('usuarios').findOneAndUpdate(
    { id },
    { $set: patch },
    { returnDocument: 'after', projection: PUBLIC_USER_PROJECTION }
  );
}

export async function deleteUsuario(id) {
  await getDb().collection('usuarios').deleteOne({ id });
}

// Devuelve el perfil del anfitrión con sus propiedades activas embebidas.
// Usa $lookup para resolver todo en una sola query en lugar de dos llamadas separadas.
export async function getAnfitrionConPropiedades(id) {
  const docs = await getDb().collection('usuarios').aggregate([
    { $match: { id, tipo: 'anfitrion' } },
    {
      $lookup: {
        from: 'propiedades',
        let: { uid: '$id' },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ['$anfitrion_id', '$$uid'] },
            { $ne: ['$estado', 'eliminada'] },
          ]}}},
          { $project: { _id: 0 } },
        ],
        as: 'propiedades',
      },
    },
    { $project: { _id: 0, password_hash: 0 } },
  ]).toArray();
  return docs[0] || null;
}

// Actualiza solo el password_hash. Separa la lógica de auth del update de perfil.
export async function updatePassword(id, newHash) {
  await getDb().collection('usuarios').updateOne({ id }, { $set: { password_hash: newHash } });
}

// ── Propiedades ───────────────────────────────────────────────────────────────

export async function getPropiedades({ ciudad, tipo, precioMin, precioMax, anfitrion_id, lat, lng, radioKm } = {}) {
  const col = getDb().collection('propiedades');

  // Búsqueda geoespacial: usar $geoNear como primera etapa del pipeline
  if (lat !== undefined && lng !== undefined && radioKm !== undefined) {
    const pipeline = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          distanceField: 'distancia_metros',
          maxDistance: Number(radioKm) * 1000,
          spherical: true,
          query: { estado: { $ne: 'eliminada' } },
        },
      },
    ];
    if (ciudad) pipeline.push({ $match: { 'ubicacion.ciudad': { $regex: ciudad, $options: 'i' } } });
    if (tipo) pipeline.push({ $match: { tipo } });
    if (anfitrion_id) pipeline.push({ $match: { anfitrion_id } });
    if (precioMin) pipeline.push({ $match: { precio_noche: { $gte: Number(precioMin) } } });
    if (precioMax) pipeline.push({ $match: { precio_noche: { $lte: Number(precioMax) } } });
    pipeline.push({ $project: { _id: 0 } });
    return col.aggregate(pipeline).toArray();
  }

  const filtro = { estado: { $ne: 'eliminada' } };
  if (ciudad) filtro['ubicacion.ciudad'] = { $regex: ciudad, $options: 'i' };
  if (tipo) filtro.tipo = tipo;
  if (anfitrion_id) filtro.anfitrion_id = anfitrion_id;
  if (precioMin) filtro.precio_noche = { ...filtro.precio_noche, $gte: Number(precioMin) };
  if (precioMax) filtro.precio_noche = { ...filtro.precio_noche, $lte: Number(precioMax) };

  return col.find(filtro, { projection: { _id: 0 } }).toArray();
}

export function getPropiedadById(id) {
  return getDb().collection('propiedades').findOne(
    { id, estado: { $ne: 'eliminada' } },
    { projection: { _id: 0 } }
  );
}

export async function createPropiedad(doc) {
  await getDb().collection('propiedades').insertOne(doc);
  return getPropiedadById(doc.id);
}

export async function updatePropiedad(id, patch) {
  return getDb().collection('propiedades').findOneAndUpdate(
    { id },
    { $set: patch },
    { returnDocument: 'after', projection: { _id: 0 } }
  );
}

// ── Ratings ───────────────────────────────────────────────────────────────────

export async function recalcRatings(propiedad_id, anfitrion_id) {
  const col = getDb().collection('resenias_cache');
  // Recalcular rating de la propiedad
  const resProp = await col.find({ propiedad_id }).toArray();
  const propRating = resProp.length
    ? +(resProp.reduce((a, r) => a + r.calificacion, 0) / resProp.length).toFixed(2)
    : 0;
  await getDb().collection('propiedades').updateOne({ id: propiedad_id }, { $set: { promedio_rating: propRating } });

  // Recalcular rating del anfitrión
  const resHost = await col.find({ anfitrion_id }).toArray();
  const hostRating = resHost.length
    ? +(resHost.reduce((a, r) => a + r.calificacion, 0) / resHost.length).toFixed(2)
    : 0;
  await getDb().collection('usuarios').updateOne({ id: anfitrion_id }, { $set: { promedio_rating: hostRating } });
}

// Guarda una copia ligera de la reseña en Mongo para calcular promedios
export function cacheResenia(doc) {
  return getDb().collection('resenias_cache').insertOne({
    id: doc.id,
    reserva_id: doc.reserva_id,
    propiedad_id: doc.propiedad_id,
    anfitrion_id: doc.anfitrion_id,
    huesped_id: doc.huesped_id,
    calificacion: doc.calificacion,
  });
}

export async function seedReseniaCache(resenias) {
  for (const r of resenias) {
    await getDb().collection('resenias_cache').updateOne(
      { id: r.id },
      { $setOnInsert: { id: r.id, reserva_id: r.reserva_id, propiedad_id: r.propiedad_id, anfitrion_id: r.anfitrion_id, huesped_id: r.huesped_id, calificacion: r.calificacion } },
      { upsert: true }
    );
  }
  // Recalcular ratings de cada par (propiedad, anfitrion) afectado
  const pairs = [...new Set(resenias.map(r => `${r.propiedad_id}|${r.anfitrion_id}`))];
  for (const pair of pairs) {
    const [propiedad_id, anfitrion_id] = pair.split('|');
    await recalcRatings(propiedad_id, anfitrion_id);
  }
  console.log(`MongoDB seed: cache de ${resenias.length} reseñas y ratings recalculados`);
}

export function existeReseniaCacheParaReserva(reserva_id) {
  return getDb().collection('resenias_cache').findOne({ reserva_id });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getDashboardMongo() {
  const [totalUsuarios, anfitriones, huespedes, totalProps] = await Promise.all([
    getDb().collection('usuarios').countDocuments(),
    getDb().collection('usuarios').countDocuments({ tipo: 'anfitrion' }),
    getDb().collection('usuarios').countDocuments({ tipo: 'huesped' }),
    getDb().collection('propiedades').countDocuments({ estado: 'activa' }),
  ]);
  return { totalUsuarios, anfitriones, huespedes, totalProps };
}
