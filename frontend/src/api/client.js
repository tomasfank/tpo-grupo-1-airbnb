import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });

const unwrap = res => res.data.data;
export const getData = (url, config) => api.get(url, config).then(unwrap);
export const postData = (url, data) => api.post(url, data).then(unwrap);
export const putData = (url, data) => api.put(url, data).then(unwrap);
export const patchData = (url, data) => api.patch(url, data).then(unwrap);
export const deleteData = url => api.delete(url).then(unwrap);
export const apiError = e => e.response?.data?.message || e.message || 'Error inesperado';
