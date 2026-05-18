import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiError, getData, postData } from '../api/client';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'success') => setToast({ message, type });
  const clearToast = () => setToast(null);

  const load = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const [us, pr, re, da] = await Promise.all([
        getData('/usuarios'),
        getData('/propiedades', { params: filters }),
        getData('/reservas'),
        getData('/dashboard')
      ]);
      setUsuarios(us); setPropiedades(pr); setReservas(re); setDashboard(da);
    } catch (e) {
      notify(apiError(e), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async usuario_id => {
    const logged = await postData('/auth/login-simulado', { usuario_id });
    setUser(logged);
    notify(`Ingresaste como ${logged.nombre}`);
  };

  const logout = () => { setUser(null); notify('Sesión simulada cerrada'); };

  const run = async (fn, success = 'Operación realizada') => {
    try { const result = await fn(); notify(success); await load(); return result; }
    catch(e) { notify(apiError(e), 'error'); throw e; }
  };

  useEffect(() => { load(); }, [load]);
  const value = useMemo(() => ({ user, usuarios, propiedades, reservas, dashboard, loading, toast, login, logout, load, run, notify, clearToast }), [user, usuarios, propiedades, reservas, dashboard, loading, toast, load]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
