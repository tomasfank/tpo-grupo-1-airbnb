import { db } from './data.js';

export const ok = (res, data, status = 200) => res.status(status).json({ ok: true, data });
export const fail = (res, status, message) => res.status(status).json({ ok: false, message });
export const findUser = id => db.usuarios.find(u => u.id === id);
export const findProp = id => db.propiedades.find(p => p.id === id);
export const overlap = (aStart, aEnd, bStart, bEnd) => new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
export const nightsBetween = (start, end) => Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
export const hydrateReserva = r => ({ ...r, huesped: findUser(r.huesped_id), anfitrion: findUser(r.anfitrion_id), propiedad: findProp(r.propiedad_id), resenia: db.resenias.find(x => x.reserva_id === r.id) || null });
export const distanceKm = (lat1,lng1,lat2,lng2) => {
  const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};
export function recalcRatings(propiedadId, anfitrionId) {
  const propReviews = db.resenias.filter(r => r.propiedad_id === propiedadId);
  const prop = findProp(propiedadId);
  if (prop) prop.promedio_rating = propReviews.length ? +(propReviews.reduce((a,r)=>a+Number(r.calificacion),0)/propReviews.length).toFixed(2) : 0;
  const hostReviews = db.resenias.filter(r => r.anfitrion_id === anfitrionId);
  const host = findUser(anfitrionId);
  if (host) host.promedio_rating = hostReviews.length ? +(hostReviews.reduce((a,r)=>a+Number(r.calificacion),0)/hostReviews.length).toFixed(2) : 0;
}
