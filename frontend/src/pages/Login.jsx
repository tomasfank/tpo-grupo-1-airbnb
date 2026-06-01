import React, { useState, useEffect } from 'react';
import { LogIn, UserPlus, LogOut, ShieldCheck, Pencil, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { Field, Badge } from '../components/Common';

const SEED_EMAILS = [
  { email: 'admin@mail.com',       tipo: 'admin'     },
  { email: 'ana.host@mail.com',    tipo: 'anfitrion' },
  { email: 'carlos.host@mail.com', tipo: 'anfitrion' },
  { email: 'lucia@mail.com',       tipo: 'huesped'   },
  { email: 'martin@mail.com',      tipo: 'huesped'   },
];

const INITIAL = { email: '', password: '', nombre: '', tipo: 'huesped', telefono: '', bio: '' };

export default function Login() {
  const { user, login, register, logout, updateProfile } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ nombre: '', telefono: '', bio: '' });

  useEffect(() => {
    if (user) setEditForm({ nombre: user.nombre || '', telefono: user.telefono || '', bio: user.bio || '' });
  }, [user]);

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'login') await login(form.email.trim(), form.password);
      else await register({ ...form, email: form.email.trim(), nombre: form.nombre.trim() });
      setForm(INITIAL);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error al procesar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (email) => {
    setForm(f => ({ ...f, email, password: 'demo1234' }));
    setError('');
  };

  const saveProfile = async () => {
    try {
      await updateProfile(editForm);
      setEditing(false);
    } catch { /* error ya notificado por updateProfile */ }
  };

  if (user) {
    return <div className="stack">
      <section className="panel" style={{maxWidth: 520, margin: '0 auto', width: '100%'}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <ShieldCheck size={22} color="var(--green)"/>
            <h3 style={{margin: 0}}>Mi cuenta</h3>
          </div>
          <button
            className="ghost"
            onClick={() => setEditing(e => !e)}
            style={{display: 'inline-flex', alignItems: 'center', gap: 6}}
          >
            {editing ? <><X size={15}/> Cancelar</> : <><Pencil size={15}/> Editar perfil</>}
          </button>
        </div>

        {!editing ? <>
          <div className="userPill" style={{marginTop: 8}}>
            <div className="avatar">{user.nombre?.[0]?.toUpperCase() || '?'}</div>
            <span>
              <b>{user.nombre}</b>
              <small>{user.tipo} · {user.email}</small>
            </span>
          </div>
          <div style={{marginTop: 12, display: 'grid', gap: 6}}>
            <Badge tone="green">ID: {user.id}</Badge>
            {user.telefono && <Badge>Tel: {user.telefono}</Badge>}
            {user.bio && <p className="muted small" style={{margin: 0}}>{user.bio}</p>}
          </div>
        </> : <>
          <p className="muted small" style={{marginTop: 4}}>Podés actualizar tu nombre, teléfono y bio. El tipo de cuenta no se puede cambiar.</p>
          <div style={{marginTop: 12, display: 'grid', gap: 10}}>
            <Field label="Nombre">
              <input value={editForm.nombre} onChange={e => setEditForm(f => ({...f, nombre: e.target.value}))} />
            </Field>
            <Field label="Teléfono">
              <input value={editForm.telefono} onChange={e => setEditForm(f => ({...f, telefono: e.target.value}))} />
            </Field>
            <Field label="Bio">
              <textarea value={editForm.bio} onChange={e => setEditForm(f => ({...f, bio: e.target.value}))} rows={3}/>
            </Field>
            <button onClick={saveProfile} disabled={!editForm.nombre}>Guardar cambios</button>
          </div>
        </>}

        <button className="danger" onClick={logout} style={{marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8}}>
          <LogOut size={16}/> Cerrar sesión
        </button>
      </section>
    </div>;
  }

  return <div className="stack">
    <section className="panel" style={{maxWidth: 520, margin: '0 auto', width: '100%'}}>
      <h3 style={{margin: 0}}>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h3>
      <p className="muted small" style={{marginTop: 4}}>
        {mode === 'login'
          ? 'Ingresá con tu email y contraseña.'
          : 'Registrate como huésped o anfitrión. Se guarda en MongoDB con hash bcrypt.'}
      </p>

      <form onSubmit={submit} style={{marginTop: 16, display: 'grid', gap: 12}}>
        {mode === 'register' && (
          <Field label="Nombre completo">
            <input
              value={form.nombre}
              onChange={e => setField('nombre', e.target.value)}
              required
              placeholder="Juan Pérez"
            />
          </Field>
        )}

        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={e => setField('email', e.target.value)}
            required
            placeholder="usuario@mail.com"
            autoComplete="email"
          />
        </Field>

        <Field label="Contraseña">
          <input
            type="password"
            value={form.password}
            onChange={e => setField('password', e.target.value)}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>

        {mode === 'register' && <>
          <Field label="Tipo de cuenta">
            <select value={form.tipo} onChange={e => setField('tipo', e.target.value)}>
              <option value="huesped">Huésped</option>
              <option value="anfitrion">Anfitrión</option>
            </select>
          </Field>
          <Field label="Teléfono (opcional)">
            <input
              value={form.telefono}
              onChange={e => setField('telefono', e.target.value)}
              placeholder="11-1234-5678"
            />
          </Field>
          <Field label="Bio (opcional)">
            <textarea
              value={form.bio}
              onChange={e => setField('bio', e.target.value)}
              placeholder="Contanos algo sobre vos..."
            />
          </Field>
        </>}

        {error && <div className="toast error" style={{position: 'static', margin: 0}}>
          <span>{error}</span>
        </div>}

        <button type="submit" disabled={submitting} style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8}}>
          {mode === 'login'
            ? <><LogIn size={16}/> {submitting ? 'Ingresando...' : 'Iniciar sesión'}</>
            : <><UserPlus size={16}/> {submitting ? 'Creando...' : 'Crear cuenta'}</>
          }
        </button>
      </form>

      <div style={{marginTop: 16, textAlign: 'center'}}>
        <button
          className="ghost"
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </div>

      {mode === 'login' && (
        <div className="notice" style={{marginTop: 16}}>
          <b>Credenciales de prueba</b>
          <p className="small muted" style={{margin: '4px 0 8px'}}>
            Hacé click en un email para autocompletar. Password: <code>demo1234</code>
          </p>
          <div style={{display: 'grid', gap: 6}}>
            {SEED_EMAILS.map(s => (
              <button
                key={s.email}
                type="button"
                className="ghost"
                onClick={() => fillDemo(s.email)}
                style={{justifyContent: 'space-between', display: 'flex', textAlign: 'left'}}
              >
                <span>{s.email}</span>
                <Badge tone={s.tipo === 'anfitrion' ? 'pink' : 'blue'}>{s.tipo}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  </div>;
}
