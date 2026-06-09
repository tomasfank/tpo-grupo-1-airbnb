import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider, useApp } from './state/AppContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Explorar from './pages/Explorar';
import Reservas from './pages/Reservas';
import Anfitrion from './pages/Anfitrion';
import Usuarios from './pages/Usuarios';
import Resenias from './pages/Resenias';
import Login from './pages/Login';
import './styles.css';

const canAccess = (page, user) => {
  if (page === 'dashboard' || page === 'explorar' || page === 'login') return true;
  if (!user) return false;
  if (page === 'anfitrion') return user.tipo === 'anfitrion';
  if (page === 'usuarios')  return user.tipo === 'admin';
  return true; // reservas, resenias: cualquier usuario logueado
};

function App() {
  const [page, setPage] = useState('dashboard');
  const { loading, initialized, user, clearToast } = useApp();

  useEffect(() => {
    if (!canAccess(page, user)) setPage('dashboard');
  }, [user, page]);

  const setPageSafe = (p) => { if (canAccess(p, user)) { clearToast(); setPage(p); } };
  const safePage = canAccess(page, user) ? page : 'dashboard';

  const pages = { dashboard:<Dashboard setPage={setPageSafe}/>, explorar:<Explorar/>, reservas:<Reservas/>, anfitrion:<Anfitrion/>, usuarios:<Usuarios/>, resenias:<Resenias/>, login:<Login/> };
  return <Layout page={safePage} setPage={setPageSafe}>{!initialized ? <div className="loading">Cargando datos...</div> : pages[safePage]}</Layout>;
}

createRoot(document.getElementById('root')).render(<AppProvider><App/></AppProvider>);
