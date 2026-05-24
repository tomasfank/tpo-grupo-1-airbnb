import React from 'react';
import { BedDouble, CalendarCheck, Home, HousePlus, KeyRound, LayoutDashboard, LogIn, LogOut, MessageSquareText, UserRoundCog, UsersRound } from 'lucide-react';
import { useApp } from '../state/AppContext';

const ALL_MENU = [
  { id: 'dashboard', label: 'Inicio',    Icon: LayoutDashboard,   roles: null },
  { id: 'explorar',  label: 'Explorar',  Icon: Home,              roles: null },
  { id: 'reservas',  label: 'Reservas',  Icon: CalendarCheck,     roles: ['huesped','anfitrion','admin'] },
  { id: 'anfitrion', label: 'Anfitrión', Icon: HousePlus,         roles: ['anfitrion'] },
  { id: 'usuarios',  label: 'Usuarios',  Icon: UsersRound,        roles: ['admin'] },
  { id: 'resenias',  label: 'Reseñas',   Icon: MessageSquareText, roles: ['huesped','anfitrion','admin'] },
  { id: 'login',     label: 'Mi cuenta', Icon: KeyRound,          roles: null },
];

export default function Layout({ page, setPage, children }) {
  const { user, logout, toast, clearToast } = useApp();
  const menu = ALL_MENU.filter(item => !item.roles || (user?.tipo && item.roles.includes(user.tipo)));
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brandIcon"><BedDouble size={22}/></div>
        <div><b>Airbnb TPO</b><span>ID2 · NoSQL + SQL</span></div>
      </div>
      <nav className="menu">
        {menu.map(({ id, label, Icon }) => (
          <button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}>
            <Icon size={18}/>{label}
          </button>
        ))}
      </nav>
      <div className="loginBox">
        {user ? <>
          <div className="muted small">Sesión activa</div>
          <div className="userPill">
            <UserRoundCog size={16}/>
            <span>{user.nombre}<small>{user.tipo}</small></span>
          </div>
          <button className="ghost" onClick={logout} style={{marginTop: 10, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6}}>
            <LogOut size={14}/> Salir
          </button>
        </> : <>
          <div className="muted small">No iniciaste sesión</div>
          <button onClick={()=>setPage('login')} style={{marginTop: 10, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6}}>
            <LogIn size={14}/> Iniciar sesión
          </button>
        </>}
      </div>
    </aside>
    <main className="content">
      <header className="topbar">
        <div>
          <h1>{ALL_MENU.find(m=>m.id===page)?.label || 'Airbnb TPO'}</h1>
          <p>Demo funcional con API REST, login con bcrypt y persistencia en 4 bases.</p>
        </div>
        {user && <button className="ghost" onClick={logout}>Salir</button>}
      </header>
      {toast && <div className={`toast ${toast.type}`}>
        <span>{toast.message}</span>
        <button onClick={clearToast}>×</button>
      </div>}
      {children}
    </main>
  </div>;
}
