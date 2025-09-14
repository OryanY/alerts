    import { JERUSALEM_TZ } from './constants';

// Helper: IL calendar formatter for YYYY-MM-DD
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
