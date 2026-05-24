import React, { useMemo, useState } from 'react';
import { patchData, postData } from '../api/client';
import { Badge, EmptyState, Money } from '../components/Common';
import { useApp } from '../state/AppContext';

export default function Reservas() {
  const { user, reservas, run } = useApp();
  const [review, setReview] = useState({});
  const visible = useMemo(() => {
    if (!user) return [];
    if (user.tipo === 'huesped')   return reservas.filter(r => r.huesped_id   === user.id);
    if (user.tipo === 'anfitrion') return reservas.filter(r => r.anfitrion_id === user.id);
    return reservas;
  }, [reservas, user]);
  const tone = estado => estado === 'confirmada' ? 'green' : estado === 'cancelada' ? 'red' : 'blue';
  if (!user) return <section className="stack"><EmptyState title="Acceso restringido" text="Iniciá sesión para ver tus reservas."/></section>;
  return <section className="stack"><div className="cardsGrid compact">{visible.length ? visible.map(r => <article className="reservationCard" key={r.id}><div><h3>{r.propiedad?.titulo}</h3><p className="muted">{r.fecha_inicio} → {r.fecha_fin}</p></div><Badge tone={tone(r.estado)}>{r.estado}</Badge><p>Huésped: <b>{r.huesped?.nombre}</b></p><p>Anfitrión: <b>{r.anfitrion?.nombre}</b></p><p>{r.cantidad_huespedes} huéspedes · Pago <b>{r.pago.estado}</b> · <Money value={r.pago.monto}/></p><div className="row"><button onClick={()=>run(()=>patchData(`/reservas/${r.id}/finalizar`),'Reserva finalizada y pago completado')}>Finalizar</button><button className="danger" onClick={()=>run(()=>patchData(`/reservas/${r.id}/cancelar`),'Reserva cancelada')}>Cancelar</button></div>{r.estado === 'completada' && !r.resenia && user?.tipo === 'huesped' && <div className="reviewBox"><h4>Dejar reseña</h4><select onChange={e=>setReview({...review,[r.id]:{...review[r.id],calificacion:e.target.value}})}><option value="5">5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option></select><textarea placeholder="Comentario" onChange={e=>setReview({...review,[r.id]:{...review[r.id],comentario:e.target.value}})}/><button onClick={()=>run(()=>postData('/resenias',{reserva_id:r.id,calificacion:review[r.id]?.calificacion || 5,comentario:review[r.id]?.comentario || ''}),'Reseña publicada')}>Publicar reseña</button></div>}{r.resenia && <p className="notice">Reseña: ⭐ {r.resenia.calificacion} · {r.resenia.comentario}</p>}</article>) : <EmptyState title="No hay reservas para mostrar" text="Creá una reserva desde Explorar para ver el flujo completo."/>}</div></section>;
}
