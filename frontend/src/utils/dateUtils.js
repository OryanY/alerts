// utils/dateUtils.js — Single source of truth for date/time formatting
// All timezone-aware date operations use Asia/Jerusalem (JERUSALEM_TZ from constants).

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
 * Formats an ISO string as "DD/MM, HH:MM" in Israeli time.
 * @param {string} iso - ISO date string
 * @returns {string} e.g. "09/12, 14:35"
 */
export const formatHourAndDay = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: JERUSALEM_TZ,
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(d);
};
