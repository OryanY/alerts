// utils/api.js - Single source of truth for API/fetch helpers
import { API_BASE } from './constants';

// ---- Login session (LDAP-verified token for destructive actions) ----
// POST /api/auth/login returns { token, username, expires_at }; we keep it in
// localStorage and send it as a Bearer header on deletes/toggles.
const AUTH_STORAGE_KEY = 'ad_auth';

export const getAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    if (!auth?.token || !auth?.expires_at || auth.expires_at < Date.now()) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return auth;
  } catch { return null; }
};

export const setAuth = (auth) => {
  try { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth)); } catch { /* storage unavailable */ }
};

export const clearAuth = () => {
  try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* storage unavailable */ }
};

export const getUsername = () => getAuth()?.username || '';

// Whether the server's login gate is active (cached for the session). Lets the
// UI show "login required" hints only when destructive actions are gated.
let _authStatusPromise = null;
export const fetchAuthEnabled = () => {
  if (!_authStatusPromise) {
    _authStatusPromise = fetch(buildApiUrl('/auth/status'), { credentials: 'include' })
      .then(safeJson)
      .then((j) => Boolean(j?.data?.enabled))
      .catch(() => false);
  }
  return _authStatusPromise;
};

// Spread into headers of destructive calls. Empty when not logged in so the
// backend answers 401 with a clear "login in Settings" message.
export const authHeaders = () => {
  const auth = getAuth();
  return auth ? { Authorization: `Bearer ${auth.token}` } : {};
};

export const buildApiUrl = (endpoint, params = {}) => {
  const queryString = new URLSearchParams(
    Object.entries(params || {}).filter(([, value]) => value !== '' && value !== null && value !== undefined)
  ).toString();

  return `${API_BASE}${endpoint}${queryString ? `?${queryString}` : ''}`;
};

export const safeJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.warn('Failed to parse JSON:', text.substring(0, 100));
    return {};
  }
};

export const fetchApi = async (endpoint, params = {}, options = {}) => {
  const { signal, timeoutMs = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', forwardAbort, { once: true });
    }
  }
  const timeoutId = timeoutMs
    ? setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeoutMs)
    : null;

  try {
    const res = await fetch(buildApiUrl(endpoint, params), {
      credentials: 'include',
      signal: controller.signal,
      ...fetchOptions,
    });
    const json = await safeJson(res);

    if (!res.ok) {
      throw new Error(json.error?.message || json.error || json.message || `HTTP ${res.status}: ${res.statusText}`);
    }

    return json;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }
};
