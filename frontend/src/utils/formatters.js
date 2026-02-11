// utils/formatters.js — Single source of truth for display formatting

/**
 * Escapes a value for safe CSV output.
 * Wraps in double-quotes and escapes internal quotes.
 * @param {*} val - Value to escape
 * @returns {string} CSV-safe string
 */
export const escapeCsv = (val) => {
    const s = String(val ?? '');
    return `"${s.replace(/"/g, '""')}"`;
};

/**
 * Formats a duration in seconds into a human-readable string.
 * @param {number} seconds - Duration in seconds
 * @returns {string} e.g. "2m 30s", "1h 15m", "45s"
 */
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

/**
 * Appends a hex alpha channel to a hex color string.
 * @param {string} hex - Hex color (e.g. "#3B82F6")
 * @param {string} alpha - Two-char hex alpha (e.g. "20" for ~12% opacity)
 * @returns {string} e.g. "#3B82F620"
 */
export const withAlpha = (hex, alpha = '20') => `${hex}${alpha}`;
