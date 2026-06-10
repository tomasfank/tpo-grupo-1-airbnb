import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgres://airbnb:airbnb@localhost:5432/airbnb_tpo'
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function initPostgres(retries = 20) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reservas (
          id UUID PRIMARY KEY,
          huesped_id UUID NOT NULL,
          anfitrion_id UUID NOT NULL,
          propiedad_id UUID NOT NULL,
          fecha_inicio DATE NOT NULL,
          fecha_fin DATE NOT NULL,
          cantidad_huespedes INTEGER NOT NULL CHECK (cantidad_huespedes > 0),
          estado VARCHAR(20) NOT NULL CHECK (estado IN ('confirmada', 'cancelada', 'completada')),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          CHECK (fecha_inicio < fecha_fin)
        );

        CREATE TABLE IF NOT EXISTS pagos (
          id UUID PRIMARY KEY,
          reserva_id UUID NOT NULL UNIQUE REFERENCES reservas(id) ON DELETE CASCADE,
          monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
          metodo VARCHAR(30) NOT NULL CHECK (metodo IN ('tarjeta', 'transferencia', 'efectivo')),
          estado VARCHAR(30) NOT NULL CHECK (estado IN ('pendiente', 'completado', 'rechazado')),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      console.log('PostgreSQL inicializado correctamente');
      return;
    } catch (error) {
      console.log(`PostgreSQL no disponible todavía. Reintento ${attempt}/${retries}`);
      if (attempt === retries) throw error;
      await sleep(1500);
    }
  }
}

export function mapReserva(row) {
  return {
    id: row.id,
    huesped_id: row.huesped_id,
    anfitrion_id: row.anfitrion_id,
    propiedad_id: row.propiedad_id,
    fecha_inicio: row.fecha_inicio instanceof Date ? row.fecha_inicio.toISOString().slice(0, 10) : row.fecha_inicio,
    fecha_fin: row.fecha_fin instanceof Date ? row.fecha_fin.toISOString().slice(0, 10) : row.fecha_fin,
    cantidad_huespedes: Number(row.cantidad_huespedes),
    estado: row.estado,
    pago: {
      id: row.pago_id,
      monto: Number(row.monto),
      metodo: row.metodo,
      estado: row.pago_estado
    },
    created_at: row.created_at
  };
}

export async function seedPostgres(reservas) {
  for (const r of reservas) {
    await pool.query(`
      INSERT INTO reservas (id, huesped_id, anfitrion_id, propiedad_id, fecha_inicio, fecha_fin, cantidad_huespedes, estado, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO NOTHING
    `, [r.id, r.huesped_id, r.anfitrion_id, r.propiedad_id, r.fecha_inicio, r.fecha_fin, r.cantidad_huespedes, r.estado, r.created_at]);

    await pool.query(`
      INSERT INTO pagos (id, reserva_id, monto, metodo, estado)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (id) DO NOTHING
    `, [r.pago.id, r.id, r.pago.monto, r.pago.metodo, r.pago.estado]);
  }
  console.log(`PostgreSQL seed: ${reservas.length} reservas y pagos cargados`);
}

export async function getReservaIdsByUsuario(id) {
  const { rows } = await pool.query('SELECT id FROM reservas WHERE huesped_id = $1 OR anfitrion_id = $1', [id]);
  return rows.map(r => r.id);
}

export async function deleteReservasByUsuario(id) {
  await pool.query('DELETE FROM reservas WHERE huesped_id = $1 OR anfitrion_id = $1', [id]);
}

export async function deleteReservasByPropiedad(propiedad_id) {
  await pool.query('DELETE FROM reservas WHERE propiedad_id = $1', [propiedad_id]);
}

export async function getReservaById(id, client = pool) {
  const { rows } = await client.query(`
    SELECT r.*, p.id AS pago_id, p.monto, p.metodo, p.estado AS pago_estado
    FROM reservas r
    JOIN pagos p ON p.reserva_id = r.id
    WHERE r.id = $1
  `, [id]);

  return rows[0] ? mapReserva(rows[0]) : null;
}
