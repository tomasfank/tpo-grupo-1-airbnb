import React, { useMemo } from 'react';
import { useApp } from '../state/AppContext';
import { Badge, Money } from '../components/Common';

export default function Dashboard({ setPage }) {
  const { dashboard, propiedades, reservas, user } = useApp();
  const next = useMemo(() => {
    if (!user) return [];
    const confirmed = reservas.filter(r => r.estado === 'confirmada');
    if (user.tipo === 'huesped')   return confirmed.filter(r => r.huesped_id   === user.id).slice(0, 3);
    if (user.tipo === 'anfitrion') return confirmed.filter(r => r.anfitrion_id === user.id).slice(0, 3);
    return confirmed.slice(0, 3);
  }, [reservas, user]);
  return <div className="stack">
    <section className="hero"><div><Badge tone="pink">Versión mejorada</Badge><h2>Gestión de alojamientos, reservas, pagos y reseñas</h2><p>La app cubre el flujo central del enunciado: usuarios por rol, publicación de propiedades, reserva con pago embebido, cancelación/finalización y reseñas con rating promedio.</p><div className="heroActions"><button onClick={()=>setPage('explorar')}>Buscar alojamiento</button><button className="secondary" onClick={()=>setPage('anfitrion')}>Publicar propiedad</button></div></div><div className="heroCard"><b>Sesión actual</b><p>{user ? `${user.nombre} · ${user.tipo}` : 'Sin usuario seleccionado'}</p><small>Entrá desde <b>Mi cuenta</b> con email y contraseña para operar como huésped o anfitrión.</small></div></section>
    <section className="stats">{Object.entries(dashboard || {}).map(([k,v]) => <article key={k} className="stat"><span>{k}</span><strong>{v}</strong></article>)}</section>
    <section className="twoCols"><div className="panel"><h3>Propiedades destacadas</h3>{propiedades.slice(0,3).map(p => <div className="miniItem" key={p.id}><img src={p.imagen}/><div><b>{p.titulo}</b><p>{p.ubicacion.ciudad} · <Money value={p.precio_noche}/> / noche</p></div></div>)}</div><div className="panel"><h3>Próximas reservas</h3>{next.length ? next.map(r => <div className="miniItem" key={r.id}><div className="dateBox">{r.fecha_inicio.slice(5)}</div><div><b>{r.propiedad?.titulo}</b><p>{r.huesped?.nombre} · {r.estado}</p></div></div>) : <p className="muted">Todavía no hay reservas confirmadas.</p>}</div></section>
  </div>;
}
