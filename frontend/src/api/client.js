import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });
export async function getData(url, config) { const r = await api.get(url, config); return r.data.data; }
export async function postData(url, data) { const r = await api.post(url, data); return r.data.data; }
export async function putData(url, data) { const r = await api.put(url, data); return r.data.data; }
export async function patchData(url, data={}) { const r = await api.patch(url, data); return r.data.data; }
export async function deleteData(url) { const r = await api.delete(url); return r.data.data; }
