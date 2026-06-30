import axios from 'axios';

// Centralized axios instance. A request interceptor attaches the token
// FRESH from localStorage on every request, so there is never a window
// where a call fires without auth (e.g. on first render after reload).
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: on 401, clear session and bounce to landing.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const onAuthPage = ['/', '/admin/login', '/teacher/login', '/student/login'].includes(window.location.pathname);
      if (!onAuthPage) {
        localStorage.clear();
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
