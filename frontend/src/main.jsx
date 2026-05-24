import React, { useState } from 'react';
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

function App() {
  const [page,setPage]=useState('dashboard');
  const { loading } = useApp();
  const pages = { dashboard:<Dashboard setPage={setPage}/>, explorar:<Explorar/>, reservas:<Reservas/>, anfitrion:<Anfitrion/>, usuarios:<Usuarios/>, resenias:<Resenias/>, login:<Login/> };
  return <Layout page={page} setPage={setPage}>{loading ? <div className="loading">Cargando datos...</div> : pages[page]}</Layout>;
}

createRoot(document.getElementById('root')).render(<AppProvider><App/></AppProvider>);
