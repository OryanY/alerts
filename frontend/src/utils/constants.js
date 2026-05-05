// utils/constants.js — App-wide constants and configuration defaults
const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const resolveApiBase = () => {
  if (typeof window !== 'undefined') {
    const runtimeBase =
      window.__ALERTS_API_BASE__ ||
      window.__ALERTS_CONFIG__?.apiBase ||
      window.__RUNTIME_CONFIG__?.apiBase;

    if (runtimeBase) return trimTrailingSlash(runtimeBase);
  }

  if (process.env.REACT_APP_API_BASE) {
    return trimTrailingSlash(process.env.REACT_APP_API_BASE);
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8080/api';
  }

  return '/api';
};

export const API_BASE = resolveApiBase();
export const JERUSALEM_TZ = 'Asia/Jerusalem';
export const DEFAULT_CLIENT_CFG = {
  dayStart: 8,
  dayEnd: 22,
  nightStart: 22,
  nightEnd: 8,
  falseWakeupThreshold: 120,
  clusteringEnabled: true,
  clusteringThreshold: 15,
  bands: [
    { key: 'short', label: 'Short', min: 0, max: 59, color: '#10B981' },
    { key: 'medium', label: 'Medium ', min: 60, max: 299, color: '#F59E0B' },
    { key: 'long', label: 'Long ', min: 300, max: Number.MAX_SAFE_INTEGER, color: '#EF4444' },
  ],
};
