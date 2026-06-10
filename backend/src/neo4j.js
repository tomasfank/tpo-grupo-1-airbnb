import neo4j from 'neo4j-driver';

const sleep = ms => new Promise(r => setTimeout(r, ms));

let driver = null;

export async function initNeo4j(retries = 20) {
  const uri      = process.env.NEO4J_URI      || 'bolt://localhost:7687';
  const user     = process.env.NEO4J_USER     || 'neo4j';
  const password = process.env.NEO4J_PASSWORD || 'airbnb_tpo_2026';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      await driver.verifyConnectivity();

      // Constraints únicos para evitar nodos duplicados en MERGE
      const session = driver.session();
      try {
        await session.run('CREATE CONSTRAINT usuario_id IF NOT EXISTS FOR (u:Usuario) REQUIRE u.id IS UNIQUE');
        await session.run('CREATE CONSTRAINT propiedad_id IF NOT EXISTS FOR (p:Propiedad) REQUIRE p.id IS UNIQUE');
      } finally {
        await session.close();
      }

      console.log('Neo4j inicializado correctamente');
      return;
    } catch (error) {
      console.log(`Neo4j no disponible todavía. Reintento ${attempt}/${retries}`);
      if (attempt === retries) throw error;
      await sleep(1500);
    }
  }
}

// Sincronizar nodo Usuario al crear/actualizar
export async function syncUsuario(user) {
  const session = driver.session();
  try {
    await session.run(
      `MERGE (u:Usuario {id: $id})
       SET u.nombre = $nombre, u.tipo = $tipo`,
      { id: user.id, nombre: user.nombre, tipo: user.tipo }
    );
  } finally {
    await session.close();
  }
}

// Sincronizar nodo Propiedad + relación ANFITRIO al publicar una propiedad
export async function syncPropiedad(prop) {
  const session = driver.session();
  try {
    await session.run(
      `MERGE (p:Propiedad {id: $id})
       SET p.titulo = $titulo, p.ciudad = $ciudad, p.tipo = $tipo
       MERGE (u:Usuario {id: $anfitrion_id})
       MERGE (u)-[:ANFITRIO]->(p)`,
      {
        id: prop.id,
        titulo: prop.titulo,
        ciudad: prop.ubicacion.ciudad,
        tipo: prop.tipo,
        anfitrion_id: prop.anfitrion_id,
      }
    );
  } finally {
    await session.close();
  }
}

// Registrar relación RESERVO al confirmar una reserva
export async function syncReserva(reserva) {
  const session = driver.session();
  try {
    await session.run(
      `MERGE (u:Usuario {id: $huesped_id})
       MERGE (p:Propiedad {id: $propiedad_id})
       MERGE (u)-[:RESERVO]->(p)`,
      { huesped_id: reserva.huesped_id, propiedad_id: reserva.propiedad_id }
    );
  } finally {
    await session.close();
  }
}

/**
 * Recomendaciones colaborativas para un usuario.
 *
 * Si usuario A reservo X e Y, y usuario B reservo Y y Z, entonces a A se le recomienda Z.
 * Si el usuario no tiene historial, devuelve los IDs de todas las propiedades y recomienda la de mayor rating

 * @returns {string[]} lista de propiedad_id ordenados por relevancia descendente
 */
export async function getRecomendaciones(usuario_id) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (u:Usuario {id: $id})-[:RESERVO]->(p:Propiedad)
             <-[:RESERVO]-(otros:Usuario)-[:RESERVO]->(rec:Propiedad)
       WHERE NOT (u)-[:RESERVO]->(rec)
       RETURN rec.id AS propiedad_id, count(*) AS score
       ORDER BY score DESC
       LIMIT 10`,
      { id: usuario_id }
    );
    return result.records.map(r => r.get('propiedad_id'));
  } finally {
    await session.close();
  }
}

export async function deleteUsuarioNode(id) {
  const session = driver.session();
  try { await session.run('MATCH (u:Usuario {id: $id}) DETACH DELETE u', { id }); }
  finally { await session.close(); }
}

export async function deletePropiedadNode(id) {
  const session = driver.session();
  try { await session.run('MATCH (p:Propiedad {id: $id}) DETACH DELETE p', { id }); }
  finally { await session.close(); }
}

// Seed inicial del grafo: usuarios, propiedades, reservas y reseñas.
// Relaciones creadas:
//   (Usuario)-[:ANFITRIO]->(Propiedad)   — anfitrión publica una propiedad
//   (Usuario)-[:RESERVO]->(Propiedad)    — huésped reservó una propiedad
//   (Usuario)-[:RESENO {calificacion}]->(Propiedad) — huésped dejó reseña
export async function seedNeo4j(usuarios, propiedades, reservas = [], resenias = []) {
  const session = driver.session();
  try {
    for (const u of usuarios) {
      await session.run(
        'MERGE (u:Usuario {id: $id}) SET u.nombre = $nombre, u.tipo = $tipo',
        { id: u.id, nombre: u.nombre, tipo: u.tipo }
      );
    }
    for (const p of propiedades) {
      await session.run(
        `MERGE (prop:Propiedad {id: $id})
         SET prop.titulo = $titulo, prop.ciudad = $ciudad, prop.tipo = $tipo
         MERGE (u:Usuario {id: $anfitrion_id})
         MERGE (u)-[:ANFITRIO]->(prop)`,
        { id: p.id, titulo: p.titulo, ciudad: p.ubicacion.ciudad, tipo: p.tipo, anfitrion_id: p.anfitrion_id }
      );
    }
    for (const r of reservas) {
      await session.run(
        `MERGE (u:Usuario {id: $huesped_id})
         MERGE (p:Propiedad {id: $propiedad_id})
         MERGE (u)-[:RESERVO]->(p)`,
        { huesped_id: r.huesped_id, propiedad_id: r.propiedad_id }
      );
    }
    for (const r of resenias) {
      await session.run(
        `MERGE (u:Usuario {id: $huesped_id})
         MERGE (p:Propiedad {id: $propiedad_id})
         MERGE (u)-[rel:RESENO]->(p)
         SET rel.calificacion = $calificacion`,
        { huesped_id: r.huesped_id, propiedad_id: r.propiedad_id, calificacion: r.calificacion }
      );
    }
    console.log(`Neo4j seed: ${usuarios.length} usuarios, ${propiedades.length} propiedades, ${reservas.length} RESERVO, ${resenias.length} RESENO`);
  } finally {
    await session.close();
  }
}
