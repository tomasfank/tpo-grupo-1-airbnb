import cassandra from 'cassandra-driver';

const sleep = ms => new Promise(r => setTimeout(r, ms));

let client = null;

export async function initCassandra(retries = 30) {
  const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS || 'localhost').split(',');
  const localDataCenter = process.env.CASSANDRA_LOCAL_DC || 'datacenter1';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const tempClient = new cassandra.Client({ contactPoints, localDataCenter });
      await tempClient.connect();

      // Keyspace con replicación simple (desarrollo)
      await tempClient.execute(`
        CREATE KEYSPACE IF NOT EXISTS airbnb_tpo
        WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
      `);
      await tempClient.shutdown();

      // Reconectar apuntando al keyspace
      client = new cassandra.Client({ contactPoints, localDataCenter, keyspace: 'airbnb_tpo' });
      await client.connect();

      // Patrón Cassandra: una tabla por query
      // Tabla 1: consultar reseñas por propiedad (caso de uso: ver reseñas de un alojamiento)
      await client.execute(`
        CREATE TABLE IF NOT EXISTS resenias_by_propiedad (
          propiedad_id  TEXT,
          created_at    TIMESTAMP,
          id            TEXT,
          reserva_id    TEXT,
          huesped_id    TEXT,
          anfitrion_id  TEXT,
          calificacion  INT,
          comentario    TEXT,
          PRIMARY KEY (propiedad_id, created_at, id)
        ) WITH CLUSTERING ORDER BY (created_at DESC, id ASC)
      `);

      // Tabla 2: consultar reseñas por anfitrión (caso de uso: ver historial de un anfitrión)
      await client.execute(`
        CREATE TABLE IF NOT EXISTS resenias_by_anfitrion (
          anfitrion_id  TEXT,
          created_at    TIMESTAMP,
          id            TEXT,
          reserva_id    TEXT,
          propiedad_id  TEXT,
          huesped_id    TEXT,
          calificacion  INT,
          comentario    TEXT,
          PRIMARY KEY (anfitrion_id, created_at, id)
        ) WITH CLUSTERING ORDER BY (created_at DESC, id ASC)
      `);

      // Tabla 3: lookup por reserva_id (para verificar duplicados)
      await client.execute(`
        CREATE TABLE IF NOT EXISTS resenias_by_reserva (
          reserva_id  TEXT PRIMARY KEY,
          id          TEXT,
          propiedad_id TEXT,
          anfitrion_id TEXT,
          huesped_id   TEXT,
          calificacion INT,
          comentario   TEXT,
          created_at   TIMESTAMP
        )
      `);

      console.log('Cassandra inicializado correctamente');
      return;
    } catch (error) {
      console.log(`Cassandra no disponible todavía. Reintento ${attempt}/${retries}`);
      if (attempt === retries) throw error;
      await sleep(3000);
    }
  }
}

export async function createResenia(doc) {
  const ts = new Date(doc.created_at);

  // LOGGED BATCH: las dos inserciones son atómicas (misma partición no requerida, pero garantiza consistencia)
  const batch = [
    {
      query: `INSERT INTO resenias_by_propiedad
              (propiedad_id, created_at, id, reserva_id, huesped_id, anfitrion_id, calificacion, comentario)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [doc.propiedad_id, ts, doc.id, doc.reserva_id, doc.huesped_id, doc.anfitrion_id, doc.calificacion, doc.comentario],
    },
    {
      query: `INSERT INTO resenias_by_anfitrion
              (anfitrion_id, created_at, id, reserva_id, propiedad_id, huesped_id, calificacion, comentario)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [doc.anfitrion_id, ts, doc.id, doc.reserva_id, doc.propiedad_id, doc.huesped_id, doc.calificacion, doc.comentario],
    },
    {
      query: `INSERT INTO resenias_by_reserva
              (reserva_id, id, propiedad_id, anfitrion_id, huesped_id, calificacion, comentario, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [doc.reserva_id, doc.id, doc.propiedad_id, doc.anfitrion_id, doc.huesped_id, doc.calificacion, doc.comentario, ts],
    },
  ];

  await client.batch(batch, { prepare: true });
}

export async function getReseniasByPropiedad(propiedad_id) {
  const result = await client.execute(
    'SELECT * FROM resenias_by_propiedad WHERE propiedad_id = ?',
    [propiedad_id],
    { prepare: true }
  );
  return result.rows.map(rowToResenia);
}

export async function getReseniasByAnfitrion(anfitrion_id) {
  const result = await client.execute(
    'SELECT * FROM resenias_by_anfitrion WHERE anfitrion_id = ?',
    [anfitrion_id],
    { prepare: true }
  );
  return result.rows.map(rowToResenia);
}

export async function existeReseniaParaReserva(reserva_id) {
  const result = await client.execute(
    'SELECT id FROM resenias_by_reserva WHERE reserva_id = ?',
    [reserva_id],
    { prepare: true }
  );
  return result.rows.length > 0;
}

// Para GET /api/resenias (listado general, sin filtro de partición)
// Nota: ALLOW FILTERING es aceptable en desarrollo/TPO; en producción se usaría una tabla adicional
export async function getResenias() {
  const result = await client.execute('SELECT * FROM resenias_by_reserva');
  return result.rows.map(rowToResenia);
}

function rowToResenia(row) {
  return {
    id: row.id,
    reserva_id: row.reserva_id,
    propiedad_id: row.propiedad_id,
    anfitrion_id: row.anfitrion_id,
    huesped_id: row.huesped_id,
    calificacion: row.calificacion,
    comentario: row.comentario,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}
