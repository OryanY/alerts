// src/lib/api.js
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

export class APIError extends Error {
  constructor(message, status, endpoint) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

const memCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 min
const persistKey = (url) => `cache:${url}`;

const shouldRetry = (status) => {
  if (!status) return true; // network/abort/timeouts
  if (status === 408 || status === 429) return true;
  // retry only 5xx
  return status >= 500 && status <= 599;
};

export const apiRequest = async (url, options = {}) => {
  const { retries = 3, timeout = 10000, useCache = true, persistCache = true } = options;

  const now = Date.now();
  // in-memory cache
  if (useCache && memCache.has(url)) {
    const c = memCache.get(url);
    if (now - c.timestamp < CACHE_DURATION) return c.data;
  }
  // sessionStorage cache
  if (useCache && persistCache && typeof sessionStorage !== 'undefined') {
    const raw = sessionStorage.getItem(persistKey(url));
    if (raw) {
      try {
        const { timestamp, data } = JSON.parse(raw);
        if (now - timestamp < CACHE_DURATION) return data;
      } catch {}
    }
  }

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);

      if (!res.ok) {
        const err = new APIError(`HTTP ${res.status}: ${res.statusText}`, res.status, url);
        if (attempt === retries || !shouldRetry(res.status)) throw err;
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 250)));
        continue;
      }

      const data = await res.json();
      if (useCache) {
        const entry = { data, timestamp: now };
        memCache.set(url, entry);
        if (persistCache && typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(persistKey(url), JSON.stringify(entry));
        }
      }
      return data;
    } catch (e) {
      lastErr = e;
      if (attempt === retries || (e instanceof APIError && !shouldRetry(e.status))) throw e;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 250)));
    }
  }
  throw lastErr || new APIError('Unknown network error', 0, url);
};

const clean = (obj) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([_, v]) => v !== '' && v != null));

export const fetchAlerts = async (params) => {
  const url = `${API_BASE}/alerts?${new URLSearchParams(clean(params))}`;
  return apiRequest(url);
};

export const fetchOverview = async (params) => {
  const url = `${API_BASE}/stats/overview?${new URLSearchParams(clean(params))}`;
  return apiRequest(url);
};

export const fetchByPanel = async (params) => {
  const url = `${API_BASE}/stats/by-panel?${new URLSearchParams(clean(params))}`;
  return apiRequest(url);
};

export const fetchByApplication = async (params) => {
  const url = `${API_BASE}/stats/by-application?${new URLSearchParams(clean(params))}`;
  return apiRequest(url);
};

export const exportAlerts = async (params, format = 'csv') => {
  const qp = clean({ ...params, format });
  const url = `${API_BASE}/alerts/export?${new URLSearchParams(qp)}`;
  const res = await fetch(url);
  if (!res.ok) throw new APIError(`Export failed: ${res.statusText}`, res.status, url);
  return res.blob();
};

export const clearCache = () => {
  memCache.clear();
  if (typeof sessionStorage !== 'undefined') {
    Object.keys(sessionStorage).forEach((k) => { if (k.startsWith('cache:')) sessionStorage.removeItem(k); });
  }
};
