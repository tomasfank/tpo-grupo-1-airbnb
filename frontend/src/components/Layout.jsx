import React from 'react';
import { BedDouble, CalendarCheck, Home, HousePlus, LayoutDashboard, MessageSquareText, UserRoundCog, UsersRound } from 'lucide-react';
import { useApp } from '../state/AppContext';

const menu = [
  ['dashboard','Inicio',LayoutDashboard], ['explorar','Explorar',Home], ['reservas','Reservas',CalendarCheck], ['anfitrion','Anfitrión',HousePlus], ['usuarios','Usuarios',UsersRound], ['resenias','Reseñas',MessageSquareText]
];

export default function Layout({ page, setPage, children }) {
  const { user, usuarios, login, logout, toast, clearToast } = useApp();
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brandIcon"><BedDouble size={22}/></div><div><b>Airbnb TPO</b><span>ID2 · NoSQL + SQL</span></div></div>
      <nav className="menu">{menu.map(([id,label,Icon]) => <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="loginBox"><div className="muted small">Login simulado</div><select value={user?.id || ''} onChange={e => e.target.value ? login(e.target.value) : logout()}><option value="">Elegí un usuario</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} · {u.tipo}</option>)}</select>{user && <div className="userPill"><UserRoundCog size={16}/><span>{user.nombre}<small>{user.tipo}</small></span></div>}</div>
    </aside>
    <main className="content"><header className="topbar"><div><h1>{menu.find(m=>m[0]===page)?.[1] || 'Airbnb TPO'}</h1><p>Demo funcional con API REST, login simulado y repositorios preparados para persistencia.</p></div>{user && <button className="ghost" onClick={logout}>Salir</button>}</header>{toast && <div className={`toast ${toast.type}`}><span>{toast.message}</span><button onClick={clearToast}>×</button></div>}{children}</main>
  </div>;
}
