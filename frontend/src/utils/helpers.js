
import { JERUSALEM_TZ } from './constants';

export const escapeCsv = (val) => {
  const s = String(val ?? '');
  return `"${s.replace(/"/g, '""')}"`;
};

export const formatHourAndDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
};

export const formatDuration = (seconds) => {
  if (seconds === undefined || seconds === null) return '—';
  const s = Math.round(Number(seconds));
  if (isNaN(s)) return '—';

  if (s < 60) return `${s}s`;

  // Minutes
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const remS = s % 60;
    return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
  }

  // Hours
  const h = Math.floor(s / 3600);
  const remM = Math.floor((s % 3600) / 60);
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
};


const fmtIL = new Intl.DateTimeFormat('en-CA', { timeZone: JERUSALEM_TZ });
export const toYMD_IL = (dateOrMs) => fmtIL.format(new Date(dateOrMs));

export const JerusalemTime = {
  formatTime: (ts) => {
    if (!ts) return '—';
    return new Intl.DateTimeFormat('en-IL', {
      timeZone: JERUSALEM_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(ts));
  },
  formatDateTime: (ts) => {
    if (!ts) return '—';
    return new Intl.DateTimeFormat('en-IL', {
      timeZone: JERUSALEM_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(ts));
  }
};


export const withAlpha = (hex, alpha = '20') => `${hex}${alpha}`;

/**
 * Safely parses JSON from a fetch response.
 * Handles empty bodies (like 401 challenges) gracefully.
 */
export const safeJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.warn('Failed to parse JSON:', text.substring(0, 100)); // Log only start of text
    return {};
  }
};
