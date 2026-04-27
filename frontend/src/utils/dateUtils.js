// utils/dateUtils.js — Single source of truth for date/time formatting
// IMPORTANT: time_fired / time_resolved arrive from the server already in Israel Standard Time
// (SQL converts via AT TIME ZONE). formatHourAndDay() does NOT perform any TZ conversion.

import { JERUSALEM_TZ } from './constants';

/** Intl formatter for YYYY-MM-DD in Israeli timezone */
const fmtIL = new Intl.DateTimeFormat('en-CA', { timeZone: JERUSALEM_TZ });

/**
 * Formats a date/timestamp as YYYY-MM-DD in Israeli time.
 * @param {Date|number} dateOrMs - Date object or epoch milliseconds
 * @returns {string} e.g. "2025-12-09"
 */
export const toYMD_IL = (dateOrMs) => fmtIL.format(new Date(dateOrMs));

/**
 * Formats an ISO string as "DD/MM, HH:MM".
 * The server returns times already converted to Israel Standard Time,
 * so no timezone conversion is needed — just parse and display.
 * @param {string|Date} iso - ISO date string (already in IL time) or Date object
 * @returns {string} e.g. "30/03, 18:41"
 */
export const formatHourAndDay = (iso) => {
    if (!iso) return '';
    // Strip any timezone suffix (Z, +03:00, etc.) — the value is already IL time
    const stripped = typeof iso === 'string'
        ? iso.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
        : null;
    const d = stripped ? new Date(stripped) : new Date(iso);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}, ${hours}:${mins}`;
};
