import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiError, getData, postData } from '../api/client';

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

const STORAGE_KEY = 'airbnb_tpo_user';

const readStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; }
  catch { return null; }
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [usuarios, setUsuarios] = useState([]);
  const [propiedades, setPropiedades] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'success') => setToast({ message, type });
  const clearToast = () => setToast(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 20000);
    return () => clearTimeout(timer);
  }, [toast]);

  const persistUser = u => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
  };

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

  // Login real con email + password
  const login = async (email, password) => {
    try {
      const logged = await postData('/auth/login', { email, password });
      persistUser(logged);
      notify(`Bienvenido, ${logged.nombre}`);
      return logged;
    } catch (e) {
      notify(apiError(e), 'error');
      throw e;
    }
  };

  // Registro de nuevo usuario
  const register = async (form) => {
    try {
      const created = await postData('/auth/register', form);
      persistUser(created);
      notify(`Cuenta creada: ${created.nombre}`);
      await load();
      return created;
    } catch (e) {
      notify(apiError(e), 'error');
      throw e;
    }
  };

  // Login rápido por ID (modo demo del sidebar) — mantiene compatibilidad con QA
  const loginSimulado = async usuario_id => {
    try {
      const logged = await postData('/auth/login-simulado', { usuario_id });
      persistUser(logged);
      notify(`Ingresaste como ${logged.nombre}`);
    } catch (e) {
      notify(apiError(e), 'error');
    }
  };

  const logout = () => { persistUser(null); notify('Sesión cerrada'); };

  const run = async (fn, success = 'Operación realizada') => {
    try { const result = await fn(); notify(success); await load(); return result; }
    catch(e) { notify(apiError(e), 'error'); throw e; }
  };

  useEffect(() => { load(); }, [load]);
  const value = useMemo(
    () => ({ user, usuarios, propiedades, reservas, dashboard, loading, toast, login, register, loginSimulado, logout, load, run, notify, clearToast }),
    [user, usuarios, propiedades, reservas, dashboard, loading, toast, load]
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
