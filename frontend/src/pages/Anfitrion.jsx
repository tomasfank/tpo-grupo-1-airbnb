import React, { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { deleteData, postData, putData } from '../api/client';
import { Field, Money, Badge, EmptyState } from '../components/Common';
import { useApp } from '../state/AppContext';

const initial = { titulo:'', tipo:'departamento', ciudad:'Buenos Aires', pais:'Argentina', direccion:'', precio_noche:50000, cantidad_huespedes:2, descripcion:'', servicios:'wifi,cocina', lat:-34.6, lng:-58.4 };

// positionstack API key (free tier — HTTP only, sin HTTPS)
const POSITIONSTACK_KEY = '4d9f996942db78ba8f735dd413411291';
const POSITIONSTACK_URL = 'http://api.positionstack.com/v1/forward';

// Coordenadas reales de zonas conocidas para autocompletar
const UBICACIONES_PRESET = [
  { label: 'Palermo, Buenos Aires',     ciudad: 'Buenos Aires', direccion: 'Av. Santa Fe 3200',         lat: -34.5890, lng: -58.4210 },
  { label: 'San Isidro, Buenos Aires',  ciudad: 'Buenos Aires', direccion: 'Av. del Libertador 16500',  lat: -34.4707, lng: -58.5154 },
  { label: 'Recoleta, Buenos Aires',    ciudad: 'Buenos Aires', direccion: 'Av. Alvear 1800',           lat: -34.5875, lng: -58.3933 },
  { label: 'Centro, Córdoba',           ciudad: 'Córdoba',      direccion: 'Belgrano 120',              lat: -31.4200, lng: -64.1880 },
  { label: 'Centro, Rosario',           ciudad: 'Rosario',      direccion: 'Pellegrini 900',            lat: -32.9500, lng: -60.6400 },
  { label: 'Centro, Mendoza',           ciudad: 'Mendoza',      direccion: 'Av. San Martín 1500',       lat: -32.8900, lng: -68.8440 },
  { label: 'Centro, Bariloche',         ciudad: 'Bariloche',    direccion: 'Mitre 500',                 lat: -41.1335, lng: -71.3103 },
  { label: 'Centro, Mar del Plata',     ciudad: 'Mar del Plata',direccion: 'San Martín 2500',           lat: -38.0023, lng: -57.5575 },
];

export default function Anfitrion() {
  const { user, propiedades, reservas, run, notify } = useApp();
  const [form, setForm] = useState(initial);
  const [geocoding, setGeocoding] = useState(false);
  const mine = useMemo(() => propiedades.filter(p => p.anfitrion_id === user?.id), [propiedades, user?.id]);
  const received = useMemo(() => reservas.filter(r => r.anfitrion_id === user?.id), [reservas, user?.id]);

  if (user?.tipo !== 'anfitrion') return <section className="stack"><EmptyState title="Acceso restringido" text="Solo los anfitriones pueden acceder a esta sección."/></section>;

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const fillUbicacion = u => setForm(f => ({ ...f, ciudad: u.ciudad, direccion: u.direccion, lat: u.lat, lng: u.lng }));

  const buscarCoordenadas = async () => {
    const query = [form.direccion, form.ciudad, form.pais].filter(Boolean).join(', ');
    if (!form.direccion || !form.ciudad) {
      notify('Completá dirección y ciudad antes de buscar', 'error');
      return;
    }
    setGeocoding(true);
    try {
      const url = `${POSITIONSTACK_URL}?access_key=${POSITIONSTACK_KEY}&query=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || 'Error de positionstack');
      const hit = json.data?.[0];
      if (!hit) {
        notify(`No se encontró "${query}"`, 'error');
        return;
      }
      setForm(f => ({ ...f, lat: Number(hit.latitude), lng: Number(hit.longitude) }));
      notify(`Coordenadas detectadas: ${hit.label || query}`);
    } catch (e) {
      notify(`Error al geocodificar: ${e.message}`, 'error');
    } finally {
      setGeocoding(false);
    }
  };

  const create = () => run(() => postData('/propiedades', { anfitrion_id: user.id, titulo: form.titulo, tipo: form.tipo, ubicacion: { ciudad: form.ciudad, pais: form.pais, direccion: form.direccion, coords: { type:'Point', coordinates:[Number(form.lng), Number(form.lat)] } }, precio_noche: Number(form.precio_noche), cantidad_huespedes: Number(form.cantidad_huespedes), descripcion: form.descripcion, servicios: form.servicios.split(',').map(s=>s.trim()).filter(Boolean) }), 'Propiedad publicada');

  return <div className="stack">
    <section className="twoCols">
      <div className="panel">
        <h3>Publicar propiedad</h3>
        <Field label="Título"><input value={form.titulo} onChange={e=>setField('titulo',e.target.value)}/></Field>
        <div className="formGrid">
          <Field label="Tipo"><select value={form.tipo} onChange={e=>setField('tipo',e.target.value)}><option>departamento</option><option>casa</option><option>loft</option></select></Field>
          <Field label="Ciudad"><input value={form.ciudad} onChange={e=>setField('ciudad',e.target.value)}/></Field>
          <Field label="Dirección"><input value={form.direccion} onChange={e=>setField('direccion',e.target.value)}/></Field>
          <Field label="Precio por noche"><input type="number" value={form.precio_noche} onChange={e=>setField('precio_noche',e.target.value)}/></Field>
          <Field label="Capacidad"><input type="number" value={form.cantidad_huespedes} onChange={e=>setField('cantidad_huespedes',e.target.value)}/></Field>
          <Field label="Servicios"><input value={form.servicios} onChange={e=>setField('servicios',e.target.value)}/></Field>
          <Field label="Latitud"><input type="number" step="0.0001" value={form.lat} onChange={e=>setField('lat',e.target.value)}/></Field>
          <Field label="Longitud"><input type="number" step="0.0001" value={form.lng} onChange={e=>setField('lng',e.target.value)}/></Field>
        </div>

        <button
          type="button"
          onClick={buscarCoordenadas}
          disabled={geocoding}
          style={{marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center'}}
        >
          <Search size={16}/> {geocoding ? 'Buscando coordenadas...' : 'Buscar coordenadas reales (positionstack)'}
        </button>

        <div className="notice" style={{marginTop: 12}}>
          <b><MapPin size={14} style={{verticalAlign:'-2px', marginRight:4}}/> O elegí una zona predefinida</b>
          <p className="small muted" style={{margin: '4px 0 8px'}}>
            Atajo para tests rápidos sin consumir API.
          </p>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6}}>
            {UBICACIONES_PRESET.map(u => (
              <button
                key={u.label}
                type="button"
                className="ghost"
                onClick={() => fillUbicacion(u)}
                style={{justifyContent: 'space-between', display: 'flex', textAlign: 'left', gap: 8}}
              >
                <span>{u.label}</span>
                <Badge tone="blue">{u.lat.toFixed(2)}, {u.lng.toFixed(2)}</Badge>
              </button>
            ))}
          </div>
        </div>

        <Field label="Descripción"><textarea value={form.descripcion} onChange={e=>setField('descripcion',e.target.value)}/></Field>
        <button onClick={create}>Publicar</button>
      </div>
      <div className="panel"><h3>Reservas recibidas</h3>{received.length ? received.map(r=><div className="miniItem" key={r.id}><div className="dateBox">{r.fecha_inicio.slice(5)}</div><div><b>{r.propiedad?.titulo}</b><p>{r.huesped?.nombre} · {r.estado} · <Money value={r.pago.monto}/></p></div></div>) : <p className="muted">Todavía no recibiste reservas.</p>}</div>
    </section>
    <section><h3>Mis propiedades</h3><div className="cardsGrid compact">{mine.length ? mine.map(p=><article className="propertyCard" key={p.id}><img src={p.imagen}/><div className="propertyBody"><h3>{p.titulo}</h3><p>{p.ubicacion.ciudad} · <Money value={p.precio_noche}/> · máx {p.cantidad_huespedes}</p><Badge>{p.estado}</Badge><div className="row"><button onClick={()=>run(()=>putData(`/propiedades/${p.id}`,{precio_noche:Number(p.precio_noche)+5000}),'Precio actualizado')}>Subir $5000</button><button className="danger" onClick={()=>run(()=>deleteData(`/propiedades/${p.id}`),'Propiedad eliminada')}>Eliminar</button></div></div></article>) : <EmptyState title="Sin propiedades" text="Publicá la primera propiedad desde el formulario."/>}</div></section>
  </div>;
}
