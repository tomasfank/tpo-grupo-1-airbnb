import React, { useEffect, useState } from 'react';
import { getData } from '../api/client';
import { Badge, EmptyState } from '../components/Common';
import { useApp } from '../state/AppContext';

export default function Resenias() {
  const { propiedades, user } = useApp();
  if (!user) return <section className="stack"><EmptyState title="Acceso restringido" text="Iniciá sesión para ver las reseñas."/></section>;
  const props = user.tipo === 'anfitrion' ? propiedades.filter(p => p.anfitrion_id === user.id) : propiedades;
  return <section className="cardsGrid compact">{props.length ? props.map(p=><ReviewBox key={p.id} p={p} user={user}/>) : <EmptyState title="Sin propiedades" text="No hay reseñas para mostrar."/>}</section>;
}

function ReviewBox({ p, user }) {
  const [reviews, setReviews] = useState([]);
  useEffect(() => { getData(`/propiedades/${p.id}/resenias`).then(setReviews); }, [p.id, p.promedio_rating]);
  const visible = user.tipo === 'huesped' ? reviews.filter(r => r.huesped_id === user.id) : reviews;
  if (user.tipo === 'huesped' && visible.length === 0) return null;
  return <article className="panel"><div className="propertyTitle"><h3>{p.titulo}</h3><Badge tone="pink">⭐ {p.promedio_rating || 'sin rating'}</Badge></div>{visible.length ? visible.map(r=><div className="reviewLine" key={r.id}><b>⭐ {r.calificacion}</b><p>{r.comentario || 'Sin comentario'}</p></div>) : <p className="muted">Esta propiedad todavía no tiene reseñas.</p>}</article>;
}
