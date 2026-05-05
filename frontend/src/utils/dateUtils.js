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
    let d;
    if (typeof iso === 'string') {
        // Strip any timezone suffix (Z, +03:00, etc.) — the value is already IL time
        let s = iso.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '').trim();
        // If string misses 'T' (e.g. from SQL CONVERT), replace space with T
        s = s.replace(' ', 'T');
        d = new Date(s);
    } else {
        d = new Date(iso);
    }
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}, ${hours}:${mins}`;
};

/**
 * Formats an ISO string as a locale date+time string.
 * @param {string} isoString
 * @returns {string} e.g. "04/05/26, 18:41:00"
 */
export const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('en-IL', {
        dateStyle: 'short',
        timeStyle: 'medium',
    });
};

/**
 * Given a dateRange { start_date, end_date } (YYYY-MM-DD strings),
 * returns a human-readable label for the previous equivalent period.
 * e.g. "(01/04 - 30/04)"
 * @param {{ start_date: string, end_date: string }} dateRange
 * @returns {string}
 */
export const getPrevPeriodText = (dateRange) => {
    if (!dateRange?.start_date || !dateRange?.end_date) return '';
    try {
        const parseLocal = (s) => {
            const [y, m, d] = s.split('-').map(Number);
            return new Date(y, m - 1, d);
        };
        const start = parseLocal(dateRange.start_date);
        const end = parseLocal(dateRange.end_date);
        const duration = end - start;
        const prevEnd = new Date(start.getTime() - 86400000);
        const prevStart = new Date(prevEnd.getTime() - duration);
        const fmt = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
        return `(${fmt(prevStart)} - ${fmt(prevEnd)})`;
    } catch {
        return '';
    }
};

/**
 * Safely extracts an array from an API response value.
 * Handles: direct arrays, { data: [...] } shapes, and null/undefined.
 * @param {any} value
 * @returns {Array}
 */
export const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    return [];
};
