import React, { useState } from 'react';
import { MapPin, Star, Users } from 'lucide-react';
import { postData } from '../api/client';
import { Badge, EmptyState, Field, Money } from '../components/Common';
import { useApp } from '../state/AppContext';

export default function Explorar() {
  const { user, propiedades, load, run } = useApp();
  const [filters, setFilters] = useState({ ciudad: '', tipo: '', precioMax: '' });
  const [booking, setBooking] = useState({});
  const apply = () => load(Object.fromEntries(Object.entries(filters).filter(([,v]) => v)));
  const reserve = p => run(() => postData('/reservas', { huesped_id: user?.id, propiedad_id: p.id, fecha_inicio: booking[p.id]?.inicio, fecha_fin: booking[p.id]?.fin, cantidad_huespedes: booking[p.id]?.huespedes || 1, pago: { metodo: booking[p.id]?.metodo || 'tarjeta', estado: 'pendiente' } }), 'Reserva creada correctamente');
  return <div className="stack">
    <section className="panel filters"><Field label="Ciudad"><input placeholder="Buenos Aires" value={filters.ciudad} onChange={e=>setFilters({...filters,ciudad:e.target.value})}/></Field><Field label="Tipo"><select value={filters.tipo} onChange={e=>setFilters({...filters,tipo:e.target.value})}><option value="">Todos</option><option value="departamento">Departamento</option><option value="casa">Casa</option><option value="loft">Loft</option></select></Field><Field label="Precio máximo"><input type="number" placeholder="80000" value={filters.precioMax} onChange={e=>setFilters({...filters,precioMax:e.target.value})}/></Field><button onClick={apply}>Aplicar filtros</button></section>
    <section className="cardsGrid">{propiedades.length ? propiedades.map(p => <article className="propertyCard" key={p.id}><img src={p.imagen}/><div className="propertyBody"><div className="propertyTitle"><h3>{p.titulo}</h3><Badge>{p.tipo}</Badge></div><p className="muted"><MapPin size={15}/> {p.ubicacion.direccion}, {p.ubicacion.ciudad}</p><p>{p.descripcion}</p><div className="chips">{p.servicios.map(s => <span key={s}>{s}</span>)}</div><div className="propertyMeta"><span><Users size={16}/> Máx {p.cantidad_huespedes}</span><span><Star size={16}/> {p.promedio_rating || 'Sin rating'}</span><b><Money value={p.precio_noche}/> / noche</b></div>{user?.tipo === 'huesped' ? <div className="bookingBox"><input type="date" onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],inicio:e.target.value}})}/><input type="date" onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],fin:e.target.value}})}/><input type="number" min="1" placeholder="Huéspedes" onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],huespedes:e.target.value}})}/><select onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],metodo:e.target.value}})}><option>tarjeta</option><option>transferencia</option><option>efectivo</option></select><button onClick={()=>reserve(p)}>Reservar</button></div> : <div className="notice">Ingresá como huésped para crear reservas.</div>}</div></article>) : <EmptyState title="No encontramos propiedades" text="Probá cambiar los filtros de búsqueda."/>}</section>
  </div>;
}
