import axios from 'axios';
const BASE = import.meta.env.VITE_API_URL || '';
const api = axios.create({ baseURL: BASE, withCredentials: true });
export const authService = {
  register: (d) => api.post('/users/register', d).then(r => r.data),
  login: (d) => api.post('/users/login', d).then(r => r.data),
  logout: () => api.post('/users/logout').then(r => r.data),
  me: () => api.get('/users/me').then(r => r.data),
  hmrcStatus: () => api.get('/auth/status').then(r => r.data),
  connectHmrc: (userId) => { window.location.href = `${BASE}/auth/hmrc?userId=${encodeURIComponent(userId)}`; },
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
