import React, { useEffect, useState } from 'react';
import { MapPin, Star, Users, X } from 'lucide-react';
import { getData, postData } from '../api/client';
import { Badge, EmptyState, Field, Money } from '../components/Common';
import { useApp } from '../state/AppContext';

export default function Explorar() {
  const { user, propiedades, load, run } = useApp();
  const [filters, setFilters] = useState({ ciudad: '', tipo: '', precioMax: '' });
  const [booking, setBooking] = useState({});
  const [perfilAnfitrion, setPerfilAnfitrion] = useState(null);
  const [recomendada, setRecomendada] = useState(null);

  useEffect(() => {
    if (user?.tipo === 'huesped') {
      getData(`/recomendaciones/${user.id}`)
        .then(list => setRecomendada(list?.[0] || null))
        .catch(() => setRecomendada(null));
    } else {
      setRecomendada(null);
    }
  }, [user]);

  const apply = () => load(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));

  const reserve = p => run(
    () => postData('/reservas', {
      huesped_id: user?.id,
      propiedad_id: p.id,
      fecha_inicio: booking[p.id]?.inicio,
      fecha_fin: booking[p.id]?.fin,
      cantidad_huespedes: booking[p.id]?.huespedes || 1,
      pago: { metodo: booking[p.id]?.metodo || 'tarjeta', estado: 'pendiente' },
    }),
    'Reserva creada correctamente'
  );

  const verAnfitrion = async (id) => {
    const data = await getData(`/usuarios/${id}`);
    setPerfilAnfitrion(data);
  };

  const grid = recomendada
    ? [{ ...recomendada, _recomendada: true }, ...propiedades.filter(p => p.id !== recomendada.id)]
    : propiedades;

  const cardStyle = p => p._recomendada ? { border: '2px solid #e53935', borderRadius: 12 } : {};

  return <div className="stack">

    {/* ── Panel perfil de anfitrión ─────────────────────────────────────── */}
    {perfilAnfitrion && (
      <section className="panel">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
          <h3 style={{margin:0}}>Perfil del anfitrión</h3>
          <button className="ghost" onClick={() => setPerfilAnfitrion(null)} style={{display:'inline-flex',alignItems:'center',gap:4}}>
            <X size={15}/> Cerrar
          </button>
        </div>
        <div className="userPill">
          <div className="avatar">{perfilAnfitrion.nombre?.[0]?.toUpperCase() || '?'}</div>
          <span>
            <b>{perfilAnfitrion.nombre}</b>
            <small>{perfilAnfitrion.email}</small>
          </span>
        </div>
        <div style={{marginTop:8, display:'grid', gap:4}}>
          <span className="muted small"><Star size={13}/> Rating: {perfilAnfitrion.promedio_rating || 'Sin calificaciones'}</span>
          {perfilAnfitrion.telefono && <span className="muted small">Tel: {perfilAnfitrion.telefono}</span>}
          {perfilAnfitrion.bio && <p className="muted small" style={{margin:0}}>{perfilAnfitrion.bio}</p>}
        </div>
        {perfilAnfitrion.propiedades?.length > 0 && <>
          <h4 style={{marginTop:14, marginBottom:8}}>Sus propiedades activas</h4>
          <div style={{display:'grid', gap:8}}>
            {perfilAnfitrion.propiedades.map(p => (
              <div className="miniItem" key={p.id}>
                <div className="dateBox"><MapPin size={14}/></div>
                <div>
                  <b>{p.titulo}</b>
                  <p className="muted small">{p.ubicacion.ciudad} · <Money value={p.precio_noche}/>/noche · máx {p.cantidad_huespedes} huéspedes · <Star size={12}/> {p.promedio_rating || 0}</p>
                </div>
              </div>
            ))}
          </div>
        </>}
      </section>
    )}

    {/* ── Filtros ───────────────────────────────────────────────────────── */}
    <section className="panel filters">
      <Field label="Ciudad"><input placeholder="Buenos Aires" value={filters.ciudad} onChange={e => setFilters({...filters, ciudad: e.target.value})}/></Field>
      <Field label="Tipo">
        <select value={filters.tipo} onChange={e => setFilters({...filters, tipo: e.target.value})}>
          <option value="">Todos</option>
          <option value="departamento">Departamento</option>
          <option value="casa">Casa</option>
          <option value="loft">Loft</option>
        </select>
      </Field>
      <Field label="Precio máximo"><input type="number" placeholder="80000" value={filters.precioMax} onChange={e => setFilters({...filters, precioMax: e.target.value})}/></Field>
      <button onClick={apply}>Aplicar filtros</button>
    </section>

    {/* ── Cards de propiedades ──────────────────────────────────────────── */}
    <section className="cardsGrid">
      {grid.length ? grid.map(p => (
        <article className="propertyCard" key={p.id} style={cardStyle(p)}>
          {p._recomendada && (
            <div style={{background:'#e53935',color:'#fff',fontWeight:700,fontSize:12,padding:'4px 12px',borderRadius:'10px 10px 0 0',letterSpacing:1}}>RECOMENDADA</div>
          )}
          <img src={p.imagen} alt={p.titulo}/>
          <div className="propertyBody">
            <div className="propertyTitle"><h3>{p.titulo}</h3><Badge>{p.tipo}</Badge></div>
            <p className="muted"><MapPin size={15}/> {p.ubicacion.direccion}, {p.ubicacion.ciudad}</p>
            <p>{p.descripcion}</p>
            <div className="chips">{p.servicios.map(s => <span key={s}>{s}</span>)}</div>
            <div className="propertyMeta">
              <span><Users size={16}/> Máx {p.cantidad_huespedes}</span>
              <span><Star size={16}/> {p.promedio_rating || 'Sin rating'}</span>
              <b><Money value={p.precio_noche}/> / noche</b>
            </div>

            {/* Anfitrión */}
            {p.anfitrion && (
              <div style={{display:'flex', alignItems:'center', gap:8, marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)'}}>
                <div className="avatar" style={{width:28,height:28,fontSize:13}}>{p.anfitrion.nombre?.[0]?.toUpperCase()}</div>
                <span className="muted small" style={{flex:1}}>{p.anfitrion.nombre} · <Star size={11}/> {p.anfitrion.promedio_rating || 0}</span>
                <button className="ghost" style={{padding:'2px 8px', fontSize:12}} onClick={() => verAnfitrion(p.anfitrion_id)}>
                  Ver perfil
                </button>
              </div>
            )}

            {/* Reserva */}
            {user?.tipo === 'huesped' ? (
              <div className="bookingBox">
                <input type="date" onChange={e => setBooking({...booking, [p.id]: {...booking[p.id], inicio: e.target.value}})}/>
                <input type="date" onChange={e => setBooking({...booking, [p.id]: {...booking[p.id], fin: e.target.value}})}/>
                <input type="number" min="1" placeholder="Huéspedes" onChange={e => setBooking({...booking, [p.id]: {...booking[p.id], huespedes: e.target.value}})}/>
                <select onChange={e => setBooking({...booking, [p.id]: {...booking[p.id], metodo: e.target.value}})}>
                  <option>tarjeta</option>
                  <option>transferencia</option>
                  <option>efectivo</option>
                </select>
                <button onClick={() => reserve(p)}>Reservar</button>
              </div>
            ) : (
              <div className="notice">Ingresá como huésped para crear reservas.</div>
            )}
          </div>
        </article>
      )) : <EmptyState title="No encontramos propiedades" text="Probá cambiar los filtros de búsqueda."/>}
    </section>
  </div>;
}
