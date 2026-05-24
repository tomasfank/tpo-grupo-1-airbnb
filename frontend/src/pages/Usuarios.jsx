import React, { useState } from 'react';
import { deleteData, postData } from '../api/client';
import { Badge, EmptyState, Field } from '../components/Common';
import { useApp } from '../state/AppContext';

const INITIAL = { nombre: '', email: '', password: '', telefono: '', tipo: 'huesped', bio: '' };
const badgeTone = tipo => tipo === 'anfitrion' ? 'green' : tipo === 'admin' ? 'pink' : 'blue';

export default function Usuarios() {
  const { user, usuarios, run } = useApp();
  const [form, setForm] = useState(INITIAL);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (user?.tipo !== 'admin') return <section className="stack"><EmptyState title="Acceso restringido" text="Solo el administrador puede acceder a esta sección."/></section>;

  const crear = () => {
    if (!form.password) return;
    run(() => postData('/usuarios', form), 'Usuario creado').then(() => setForm(INITIAL));
  };

  return <section className="twoCols">
    <div className="panel">
      <h3>Crear usuario</h3>
      <Field label="Nombre"><input value={form.nombre} onChange={e=>set('nombre',e.target.value)}/></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={e=>set('email',e.target.value)}/></Field>
      <Field label="Contraseña"><input type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Mínimo 6 caracteres"/></Field>
      <Field label="Teléfono"><input value={form.telefono} onChange={e=>set('telefono',e.target.value)}/></Field>
      <Field label="Tipo">
        <select value={form.tipo} onChange={e=>set('tipo',e.target.value)}>
          <option value="huesped">Huésped</option>
          <option value="anfitrion">Anfitrión</option>
          <option value="admin">Admin</option>
        </select>
      </Field>
      <Field label="Bio"><textarea value={form.bio} onChange={e=>set('bio',e.target.value)}/></Field>
      <button onClick={crear} disabled={!form.nombre || !form.email || !form.password}>Crear usuario</button>
    </div>
    <div className="panel">
      <h3>Usuarios registrados</h3>
      <div className="userGrid">
        {usuarios.map(u => <article className="userCard" key={u.id}>
          <div className="avatar">{u.nombre.slice(0,1)}</div>
          <div>
            <h4>{u.nombre}</h4>
            <p>{u.email}</p>
            <Badge tone={badgeTone(u.tipo)}>{u.tipo}</Badge>
            <p className="muted">Rating: {u.promedio_rating}</p>
            <button className="danger" onClick={()=>run(()=>deleteData(`/usuarios/${u.id}`),'Usuario eliminado')}>Eliminar</button>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
