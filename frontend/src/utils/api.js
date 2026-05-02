// utils/api.js - Single source of truth for API/fetch helpers
import { API_BASE } from './constants';

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
