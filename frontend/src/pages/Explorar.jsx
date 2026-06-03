import React, { useEffect, useState } from 'react';
import { MapPin, Star, Users, Locate, X } from 'lucide-react';
import { getData, postData } from '../api/client';
import { Badge, EmptyState, Field, Money } from '../components/Common';
import { useApp } from '../state/AppContext';

export default function Explorar() {
  const { user, propiedades, load, run, notify } = useApp();
  const [filters, setFilters] = useState({ ciudad: '', tipo: '', precioMax: '' });
  const [geo, setGeo] = useState(null);
  const [radioKm, setRadioKm] = useState(10);
  const [geoLoading, setGeoLoading] = useState(false);
  const [booking, setBooking] = useState({});
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

  const requestLocation = () => {
    if (!navigator.geolocation) {
      notify('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeo(next);
        setGeoLoading(false);
        const f = Object.fromEntries(Object.entries(filters).filter(([,v]) => v));
        load({ ...f, lat: next.lat, lng: next.lng, radioKm });
        notify(`Ubicación detectada · buscando en ${radioKm} km`);
      },
      () => {
        setGeoLoading(false);
        notify('No se pudo obtener la ubicación. Revisá los permisos del navegador.', 'error');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const clearLocation = () => {
    setGeo(null);
    const f = Object.fromEntries(Object.entries(filters).filter(([,v]) => v));
    load(f);
    notify('Ubicación desactivada');
  };

  const changeRadio = km => {
    setRadioKm(km);
    if (geo) {
      const f = Object.fromEntries(Object.entries(filters).filter(([,v]) => v));
      load({ ...f, lat: geo.lat, lng: geo.lng, radioKm: km });
    }
  };

  const apply = () => {
    const f = Object.fromEntries(Object.entries(filters).filter(([,v]) => v));
    if (geo) { f.lat = geo.lat; f.lng = geo.lng; f.radioKm = radioKm; }
    load(f);
  };

  const reserve = p => run(() => postData('/reservas', { huesped_id: user?.id, propiedad_id: p.id, fecha_inicio: booking[p.id]?.inicio, fecha_fin: booking[p.id]?.fin, cantidad_huespedes: booking[p.id]?.huespedes || 1, pago: { metodo: booking[p.id]?.metodo || 'tarjeta', estado: 'pendiente' } }), 'Reserva creada correctamente');

  const grid = recomendada
    ? [{ ...recomendada, _recomendada: true }, ...propiedades.filter(p => p.id !== recomendada.id)]
    : propiedades;

  const cardStyle = p => p._recomendada ? { border: '2px solid #e53935', borderRadius: 12 } : {};

  return <div className="stack">
    <section className="panel filters">
      <Field label="Ciudad"><input placeholder="Buenos Aires" value={filters.ciudad} onChange={e=>setFilters({...filters,ciudad:e.target.value})}/></Field>
      <Field label="Tipo"><select value={filters.tipo} onChange={e=>setFilters({...filters,tipo:e.target.value})}><option value="">Todos</option><option value="departamento">Departamento</option><option value="casa">Casa</option><option value="loft">Loft</option></select></Field>
      <Field label="Precio máximo"><input type="number" placeholder="80000" value={filters.precioMax} onChange={e=>setFilters({...filters,precioMax:e.target.value})}/></Field>
      <button onClick={apply}>Aplicar filtros</button>
    </section>

    <section className="panel" style={{display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
      <button
        onClick={geo ? clearLocation : requestLocation}
        disabled={geoLoading}
        className={geo ? 'danger' : ''}
        style={{display:'inline-flex', alignItems:'center', gap:8}}
      >
        {geo ? <><X size={16}/> Quitar ubicación</> : <><Locate size={16}/> {geoLoading ? 'Detectando...' : 'Buscar cerca de mí'}</>}
      </button>
      {geo && (
        <div style={{display:'flex', alignItems:'center', gap:10, flex:1, minWidth:240}}>
          <span className="small muted">Radio:</span>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={radioKm}
            onChange={e => setRadioKm(Number(e.target.value))}
            onMouseUp={e => changeRadio(Number(e.target.value))}
            onTouchEnd={e => changeRadio(Number(e.target.value))}
            style={{flex:1}}
          />
          <b style={{minWidth:60, textAlign:'right'}}>{radioKm} km</b>
        </div>
      )}
    </section>

    <section className="cardsGrid">{grid.length ? grid.map(p => <article className="propertyCard" key={p.id} style={cardStyle(p)}>{p._recomendada && <div style={{background:'#e53935',color:'#fff',fontWeight:700,fontSize:12,padding:'4px 12px',borderRadius:'10px 10px 0 0',letterSpacing:1}}>RECOMENDADA</div>}<img src={p.imagen}/><div className="propertyBody"><div className="propertyTitle"><h3>{p.titulo}</h3><Badge>{p.tipo}</Badge></div><p className="muted"><MapPin size={15}/> {p.ubicacion.direccion}, {p.ubicacion.ciudad}{p.distancia_metros !== undefined && <> · <b>a {(p.distancia_metros/1000).toFixed(1)} km</b></>}</p><p>{p.descripcion}</p><div className="chips">{p.servicios.map(s => <span key={s}>{s}</span>)}</div><div className="propertyMeta"><span><Users size={16}/> Máx {p.cantidad_huespedes}</span><span><Star size={16}/> {p.promedio_rating || 'Sin rating'}</span><b><Money value={p.precio_noche}/> / noche</b></div>{user?.tipo === 'huesped' ? <div className="bookingBox"><input type="date" onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],inicio:e.target.value}})}/><input type="date" onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],fin:e.target.value}})}/><input type="number" min="1" placeholder="Huéspedes" onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],huespedes:e.target.value}})}/><select onChange={e=>setBooking({...booking,[p.id]:{...booking[p.id],metodo:e.target.value}})}><option>tarjeta</option><option>transferencia</option><option>efectivo</option></select><button onClick={()=>reserve(p)}>Reservar</button></div> : <div className="notice">Ingresá como huésped para crear reservas.</div>}</div></article>) : <EmptyState title="No encontramos propiedades" text={geo ? `Probá ampliar el radio (ahora ${radioKm} km) o quitar la ubicación.` : "Probá cambiar los filtros de búsqueda."}/>}</section>
  </div>;
}
