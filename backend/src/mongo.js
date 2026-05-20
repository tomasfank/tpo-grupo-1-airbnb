import { MongoClient } from 'mongodb';
import { SEED_USUARIOS, SEED_PROPIEDADES } from './data.js';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/airbnb_tpo';
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
      await _db.collection('propiedades').createIndex({ id: 1 }, { unique: true });

      // Seed: insertar solo si no existen (upsert por id)
      for (const u of SEED_USUARIOS) {
        await _db.collection('usuarios').updateOne({ id: u.id }, { $setOnInsert: u }, { upsert: true });
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
  return getDb().collection('usuarios').find(filtro, { projection: { _id: 0 } }).toArray();
}

export function getUserById(id) {
  return getDb().collection('usuarios').findOne({ id }, { projection: { _id: 0 } });
}

export async function createUsuario(doc) {
  await getDb().collection('usuarios').insertOne(doc);
  return getUserById(doc.id);
}

export async function updateUsuario(id, patch) {
  return getDb().collection('usuarios').findOneAndUpdate(
    { id },
    { $set: patch },
    { returnDocument: 'after', projection: { _id: 0 } }
  );
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
