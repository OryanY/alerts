// utils/constants.js — App-wide constants and configuration defaults
export const API_BASE = "http://localhost:8080/api";
export const JERUSALEM_TZ = 'Asia/Jerusalem';
export const DEFAULT_CLIENT_CFG = {
  dayStart: 8,
  dayEnd: 22,
  nightStart: 22,
  nightEnd: 8,
  falseWakeupThreshold: 120,
  clusteringEnabled: true,
  clusteringThreshold: 15,
  durationMetric: 'median', // 'median' or 'average'
  bands: [
    { key: 'short', label: 'Short', min: 0, max: 59, color: '#10B981' },
    { key: 'medium', label: 'Medium ', min: 60, max: 299, color: '#F59E0B' },
    { key: 'long', label: 'Long ', min: 300, max: Number.MAX_SAFE_INTEGER, color: '#EF4444' },
  ],
};
