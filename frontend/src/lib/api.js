import axios from 'axios';

const getBaseUrl = () => {
  // Use env var if set
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  // Local development fallback
  return 'http://localhost:5000/api';
};

export const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

// Separate axios instance for file uploads — Cloudinary processing can take 60s+
export const uploadApi = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minutes for large file uploads
});

// Shared interceptor logic
const injectToken = (config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

const handleAuthError = (err) => {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname || '';
    const isAuthPage = currentPath.includes('/login') || currentPath.includes('/signup');

    if (err.response?.status === 403 && err.response?.data?.code === 'SUSPENDED') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const reason = encodeURIComponent(err.response.data.message || 'Account suspended.');
      if (!isAuthPage) {
        window.location.href = `/login?error=suspended&reason=${reason}`;
      }
    } else if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!isAuthPage) {
        window.location.href = '/login';
      }
    }
  }
  return Promise.reject(err);
};

// Inject token on every request
api.interceptors.request.use(injectToken);
api.interceptors.response.use((res) => res, handleAuthError);

// Apply same interceptors to uploadApi
uploadApi.interceptors.request.use(injectToken);
uploadApi.interceptors.response.use((res) => res, handleAuthError);

export default api;

