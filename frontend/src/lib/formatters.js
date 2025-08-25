export const formatDuration = (seconds) => {
  if (seconds == null) return 'N/A';
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return 'N/A';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r > 0 ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  if (h < 24) return mr > 0 ? `${h}h ${mr}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  const parts = [];
  parts.push(`${d}d`);
  if (hr) parts.push(`${hr}h`);
  if (mr) parts.push(`${mr}m`);
  if (r) parts.push(`${r}s`);
  return parts.join(' ');
};

export const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString();
};
