// utils/TimeUtils.js - Optimized timezone handling with batching and caching
const { DateTime } = require('luxon');

const IL_ZONE = 'Asia/Jerusalem';

class TimeUtils {
  // LRU cache for conversions (prevents repeated expensive operations)
  static _cache = new Map();
  static _maxCacheSize = 2000;

  /**
   * Clear cache (for testing or memory management)
   */
  static clearCache() {
    this._cache.clear();
  }

  /**
   * Get from cache or compute and cache
   */
  static _getOrCache(key, computeFn) {
    if (this._cache.has(key)) {
      return this._cache.get(key);
    }

    const result = computeFn();

    // LRU eviction
    if (this._cache.size >= this._maxCacheSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }

    this._cache.set(key, result);
    return result;
  }

  /**
   * Convert DB UTC Date → IL ISO string (with caching)
   */
  static utcToIL(utcDate) {
    if (!utcDate) return null;

    const timestamp = utcDate.getTime();
    const cacheKey = `il_iso_${timestamp}`;

    return this._getOrCache(cacheKey, () =>
      DateTime.fromJSDate(utcDate, { zone: 'utc' })
        .setZone(IL_ZONE)
        .toISO()
    );
  }

  /**
   * Get IL hour (0..23) from DB UTC Date (with caching)
   */
  static getILHour(utcDate) {
    if (!utcDate) return null;

    const timestamp = utcDate.getTime();
    const cacheKey = `il_hour_${timestamp}`;

    return this._getOrCache(cacheKey, () =>
      DateTime.fromJSDate(utcDate, { zone: 'utc' })
        .setZone(IL_ZONE)
        .hour
    );
  }

  /**
   * Get IL date string (YYYY-MM-DD) from DB UTC Date (with caching)
   */
  static getILDate(utcDate) {
    if (!utcDate) return null;

    const timestamp = utcDate.getTime();
    const cacheKey = `il_date_${timestamp}`;

    return this._getOrCache(cacheKey, () =>
      DateTime.fromJSDate(utcDate, { zone: 'utc' })
        .setZone(IL_ZONE)
        .toISODate()
    );
  }

  /**
   * Get IL weekday (1=Mon .. 7=Sun) from UTC Date
   */
  static getILWeekday(utcDate) {
    if (!utcDate) return null;

    const timestamp = utcDate.getTime();
    const cacheKey = `il_weekday_${timestamp}`;

    return this._getOrCache(cacheKey, () =>
      DateTime.fromJSDate(utcDate, { zone: 'utc' })
        .setZone(IL_ZONE)
        .weekday
    );
  }

  /**
   * BATCH OPERATIONS - Process multiple dates efficiently
   */
  static batchGetILHours(utcDates) {
    const results = new Map();

    for (const date of utcDates) {
      if (!date) continue;
      const timestamp = date.getTime();

      if (!results.has(timestamp)) {
        results.set(timestamp, this.getILHour(date));
      }
    }

    return results;
  }

  static batchGetILDates(utcDates) {
    const results = new Map();

    for (const date of utcDates) {
      if (!date) continue;
      const timestamp = date.getTime();

      if (!results.has(timestamp)) {
        results.set(timestamp, this.getILDate(date));
      }
    }

    return results;
  }

  /**
   * Parse IL input string → UTC Date
   * Handles: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, or full ISO
   * Date-only strings are interpreted as IL timezone start/end of day
   */
  static parseILToUTC(ilDateString, endOfDay = false) {
    if (!ilDateString) {
      throw new Error('Date is required');
    }

    const dateStr = String(ilDateString).trim();

    // Check if date-only format (YYYY-MM-DD)
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);

    let dt;

    if (isDateOnly) {
      // Parse as IL date explicitly in IL timezone
      dt = DateTime.fromISO(dateStr, { zone: IL_ZONE });

      if (!dt.isValid) {
        throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or ISO datetime`);
      }

      // Set to start or end of day IN ISRAELI TIME
      dt = endOfDay ? dt.endOf('day') : dt.startOf('day');
    } else {
      // For datetime strings, check if they have timezone info
      if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
        // Has explicit timezone, parse as-is
        dt = DateTime.fromISO(dateStr);
      } else {
        // No timezone, assume IL timezone
        dt = DateTime.fromISO(dateStr, { zone: IL_ZONE });
      }

      if (!dt.isValid) {
        throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or ISO datetime`);
      }
    }

    // Convert to UTC and return as JS Date
    return dt.toUTC().toJSDate();
  }

  /**
   * Validate and parse date range
   * Returns { start: UTC Date | null, end: UTC Date | null }
   */
  static validateDateRange(startDate, endDate, maxDays = 730) {
    if (!startDate && !endDate) return null;

    const start = startDate ? this.parseILToUTC(startDate, false) : null;
    const end = endDate ? this.parseILToUTC(endDate, true) : null;

    // Allow same date for single-day queries (start will be 00:00, end will be 23:59:59)
    if (start && end && start > end) {
      throw new Error('DATE_RANGE_INVALID: Start date must be before or equal to end date');
    }

    // Validate max range
    if (start && end && maxDays) {
      const daysDiff = (end - start) / (1000 * 60 * 60 * 24);
      if (daysDiff > maxDays) {
        throw new Error(`DATE_RANGE_INVALID: Date range cannot exceed ${maxDays} days`);
      }
    }

    return { start, end };
  }

  /**
   * Check if hour is during night shift (handles midnight wraparound)
   */
  static isNightHour(hour, nightStart, nightEnd) {
    if (hour === null || hour === undefined) return false;

    return nightStart <= nightEnd
      ? (hour >= nightStart && hour < nightEnd)
      : (hour >= nightStart || hour < nightEnd);
  }

  /**
   * Check if hour is during day shift
   */
  static isDayHour(hour, dayStart, dayEnd) {
    if (hour === null || hour === undefined) return false;
    return hour >= dayStart && hour < dayEnd;
  }

  /**
   * Get current IL date as ISO string (YYYY-MM-DD)
   */
  static getCurrentILDate() {
    return DateTime.now().setZone(IL_ZONE).toISODate();
  }

  /**
   * Get current IL time as full ISO string
   */
  static getCurrentILTime() {
    return DateTime.now().setZone(IL_ZONE).toISO();
  }

  /**
   * Get timezone display info for UI
   */
  static getTimezoneInfo() {
    const now = DateTime.now().setZone(IL_ZONE);
    return {
      zone: IL_ZONE,
      offset: now.offsetNameShort,
      isDST: now.isInDST,
      displayName: 'Israel Time',
      currentTime: now.toISO()
    };
  }

  /**
   * Format duration in seconds to human-readable string
   */
  static formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours}h ${mins}m ${secs}s`;
  }

  /**
   * Get cache statistics (for monitoring)
   */
  static getCacheStats() {
    return {
      size: this._cache.size,
      maxSize: this._maxCacheSize,
      utilization: ((this._cache.size / this._maxCacheSize) * 100).toFixed(1) + '%'
    };
  }
}

module.exports = { TimeUtils, IL_ZONE };