import { fraudDataHeader } from './fraudHeaders.js';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({ baseURL: BASE, withCredentials: false });

// Attach token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  try { config.headers['X-Hmrc-Client-Data'] = fraudDataHeader(); } catch {}
  return config;
});

export const authService = {
  register: async (d) => {
    const res = await api.post('/users/register', d);
    if (res.data.token) localStorage.setItem('auth_token', res.data.token);
    return res.data;
  },
  login: async (d) => {
    const res = await api.post('/users/login', d);
    if (res.data.token) localStorage.setItem('auth_token', res.data.token);
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    return api.post('/users/logout').then(r => r.data);
  },
  me: () => api.get('/users/me').then(r => r.data),
  hmrcStatus: () => api.get('/auth/status').then(r => r.data),
  connectHmrc: (userId) => {
    window.location.href = `${BASE}/auth/hmrc?userId=${encodeURIComponent(userId)}`;
  },
};

export const businessService = {
  list: () => api.get('/businesses').then(r => r.data),
  get: (id) => api.get(`/businesses/${id}`).then(r => r.data),
  create: (d) => api.post('/businesses', d).then(r => r.data),
  update: (id, d) => api.put(`/businesses/${id}`, d).then(r => r.data),
};

export const submissionService = {
  getObligations: (bId) => api.get(`/submissions/obligations/vat/${bId}`).then(r => r.data),
  submitNilVat: (d) => api.post('/submissions/vat/nil', d).then(r => r.data),
  submitDormantCt: (d) => api.post('/submissions/ct/dormant', d).then(r => r.data),
  history: (bId) => api.get(`/submissions/${bId}`).then(r => r.data),
};

export default api;
