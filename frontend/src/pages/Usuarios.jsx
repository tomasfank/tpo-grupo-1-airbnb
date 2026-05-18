import React, { useState } from 'react';
import { postData, putData } from '../api/client';
import { Badge, Field } from '../components/Common';
import { useApp } from '../state/AppContext';

export default function Usuarios() {
  const { usuarios, run } = useApp();
  const [form,setForm]=useState({nombre:'',email:'',telefono:'',tipo:'huesped',bio:''});
  return <section className="twoCols"><div className="panel"><h3>Crear usuario</h3><Field label="Nombre"><input value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></Field><Field label="Email"><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Teléfono"><input value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/></Field><Field label="Tipo"><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value})}><option value="huesped">Huésped</option><option value="anfitrion">Anfitrión</option></select></Field><Field label="Bio"><textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})}/></Field><button onClick={()=>run(()=>postData('/usuarios', form),'Usuario creado')}>Crear usuario</button></div><div className="panel"><h3>Usuarios registrados</h3><div className="userGrid">{usuarios.map(u=><article className="userCard" key={u.id}><div className="avatar">{u.nombre.slice(0,1)}</div><div><h4>{u.nombre}</h4><p>{u.email}</p><Badge tone={u.tipo==='anfitrion'?'green':'blue'}>{u.tipo}</Badge><p className="muted">Rating: {u.promedio_rating}</p><button className="secondary" onClick={()=>run(()=>putData(`/usuarios/${u.id}`,{telefono:'actualizado por demo'}),'Usuario actualizado')}>Actualizar teléfono demo</button></div></article>)}</div></div></section>;
}
