// utils/api.js - Single source of truth for API/fetch helpers
import { API_BASE } from './constants';

// ---- Login session (LDAP-verified) ----
// POST /api/auth/login sets an httpOnly session cookie (never readable by page
// JS) and a separate, non-httpOnly csrf cookie, and returns { username,
// expires_at }. We keep that (non-sensitive) metadata in localStorage purely
// so the UI can show "logged in as X until HH:MM" without asking the server;
// the actual authorization is enforced server-side by the cookie every request
// already sends via credentials:'include'.
const AUTH_STORAGE_KEY = 'ad_auth';
const CSRF_COOKIE = 'csrf_token';

export const getAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const auth = JSON.parse(raw);
    if (!auth?.expires_at || auth.expires_at < Date.now()) {
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

// Tells the server to clear the httpOnly/csrf cookies, then drops the local
// display metadata. Best-effort: if the network call fails, the cookies will
// simply expire on their own (AUTH_TOKEN_TTL_HOURS).
export const logout = async () => {
  try {
    await fetch(buildApiUrl('/auth/logout'), { method: 'POST', credentials: 'include' });
  } catch { /* cookies expire on their own */ }
  clearAuth();
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

const readCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

// Spread into headers of destructive calls. The csrf cookie is only set once
// logged in, so this is empty when not logged in — the backend then answers
// 401 with a clear "login in Settings" message rather than a CSRF error.
export const authHeaders = () => {
  const csrf = readCookie(CSRF_COOKIE);
  return csrf ? { 'X-CSRF-Token': csrf } : {};
};

// The auth_token cookie is httpOnly (unreadable by JS), so we can't check it
// directly — but the browser only keeps the csrf cookie around when it also
// accepted auth_token (both are set together, same request, same attributes).
// Its presence is therefore the only client-side signal that the session
// cookie actually landed, e.g. wasn't silently dropped by a SameSite/Secure
// mismatch between the server's cookie config and the deployment's origin
// topology.
export const hasSessionCookie = () => !!readCookie(CSRF_COOKIE);

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
