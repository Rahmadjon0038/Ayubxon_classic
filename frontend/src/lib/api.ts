import axios, { AxiosError } from 'axios';
import { getActiveLocale, translate } from './i18n';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.inboxcrm.uz';

const TOKEN_KEY = 'admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// Super-admin — oddiy admin bilan bir xil brauzerda ham ishlashi mumkin bo'lishi uchun
// butunlay alohida token kaliti va axios instansi ishlatiladi.
const SUPER_ADMIN_TOKEN_KEY = 'super_admin_token';

export function getSuperAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SUPER_ADMIN_TOKEN_KEY);
}

export function setSuperAdminToken(token: string) {
  localStorage.setItem(SUPER_ADMIN_TOKEN_KEY, token);
}

export function clearSuperAdminToken() {
  localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
}

export const superAdminApi = axios.create({
  baseURL: `${API_URL}/api/super-admin`,
});

superAdminApi.interceptors.request.use((config) => {
  const token = getSuperAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

superAdminApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/super-admin/login'
    ) {
      clearSuperAdminToken();
      window.location.href = '/super-admin/login';
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(err: unknown): string {
  const locale = getActiveLocale();
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: { message: string }[] } | undefined;
    if (data?.details?.length) return data.details.map((d) => d.message).join(', ');
    if (data?.error) return data.error;
    if (err.code === 'ERR_NETWORK') return translate(locale, 'errors.network');
  }
  return translate(locale, 'errors.unknown');
}
