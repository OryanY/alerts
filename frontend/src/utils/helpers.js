
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
