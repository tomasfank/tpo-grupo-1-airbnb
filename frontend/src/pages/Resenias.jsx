import React, { useEffect, useState } from 'react';
import { getData } from '../api/client';
import { Badge, EmptyState } from '../components/Common';
import { useApp } from '../state/AppContext';

export default function Resenias() {
  const { propiedades } = useApp();
  return <section className="cardsGrid compact">{propiedades.length ? propiedades.map(p=><ReviewBox key={p.id} p={p}/>) : <EmptyState title="Sin propiedades" text="No hay reseñas para mostrar."/>}</section>;
}
function ReviewBox({ p }) {
  const [reviews,setReviews]=useState([]);
  useEffect(()=>{getData(`/propiedades/${p.id}/resenias`).then(setReviews)},[p.id,p.promedio_rating]);
  return <article className="panel"><div className="propertyTitle"><h3>{p.titulo}</h3><Badge tone="pink">⭐ {p.promedio_rating || 'sin rating'}</Badge></div>{reviews.length ? reviews.map(r=><div className="reviewLine" key={r.id}><b>⭐ {r.calificacion}</b><p>{r.comentario || 'Sin comentario'}</p></div>) : <p className="muted">Esta propiedad todavía no tiene reseñas.</p>}</article>;
}
