// utils/TimeUtils.js - Centralized timezone and date handling (FIXED)
const { DateTime } = require('luxon');

const IL_ZONE = 'Asia/Jerusalem';

class TimeUtils {
  /**
   * Convert DB UTC Date → IL ISO string
   */
  static utcToIL(utcDate) {
    if (!utcDate) return null;
    return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(IL_ZONE).toISO();
  }

  /**
   * Get IL hour (0..23) from DB UTC Date (DST-safe)
   */
  static getILHour(utcDate) {
    if (!utcDate) return null;
    return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(IL_ZONE).hour;
  }

  /**
   * Get IL date string (YYYY-MM-DD) from DB UTC Date (DST-safe)
   */
  static getILDate(utcDate) {
    if (!utcDate) return null;
    return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(IL_ZONE).toISODate();
  }

  /**
   * Get IL weekday (1=Mon .. 7=Sun) from UTC Date
   */
  static getILWeekday(utcDate) {
    if (!utcDate) return null;
    return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(IL_ZONE).weekday;
  }

  /**
   * Parse IL input string → UTC Date
   * Accepts: YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, or full ISO
   * For date-only strings: sets to start of day in IL time, then converts to UTC
   * 
   * FIXED: Now correctly interprets date strings as Israeli time zone
   */
  static parseILToUTC(ilDateString, endOfDay = false) {
    if (!ilDateString) throw new Error('Date is required');

    let dt;
    
    // HANDLE FRONTEND SENDING FULL ISO STRINGS - Strip to date-only first
    let dateStr = ilDateString;
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      // If frontend sent "2025-11-08T00:00:00.000Z", extract just "2025-11-08"
      dateStr = dateStr.split('T')[0];
    }
    
    // Check if it's a date-only string (YYYY-MM-DD)
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    
    if (isDateOnly) {
      // FIXED: Parse as IL date explicitly in IL timezone
      dt = DateTime.fromISO(dateStr, { zone: IL_ZONE });
      
      if (!dt.isValid) {
        throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD or ISO datetime`);
      }
      
      // Set to start or end of day IN ISRAELI TIME
      dt = endOfDay ? dt.endOf('day') : dt.startOf('day');
    } else {
      // For datetime strings, check if they already have timezone info
      if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
        // Already has timezone, parse as-is
        dt = DateTime.fromISO(dateStr);
      } else {
        // No timezone specified, treat as IL time
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
   * Validate start/end IL-input → { start: UTC Date|null, end: UTC Date|null }
   * Always sets start to beginning of day and end to end of day in IL time
   */
  static validateDateRange(startDate, endDate) {
    if (!startDate && !endDate) return null;
    
    const start = startDate ? this.parseILToUTC(startDate, false) : null;
    const end = endDate ? this.parseILToUTC(endDate, true) : null;
    
    if (start && end && start >= end) {
      throw new Error('DATE_RANGE_INVALID: Start date must be before end date');
    }
    
    return { start, end };
  }

  /**
   * Check if hour is during night shift (handles midnight wraparound)
   */
  static isNightHour(hour, nightStart, nightEnd) {
    if (hour === null) return false;
    return nightStart <= nightEnd
      ? (hour >= nightStart && hour < nightEnd)
      : (hour >= nightStart || hour < nightEnd);
  }

  /**
   * Check if hour is during day shift
   */
  static isDayHour(hour, dayStart, dayEnd) {
    if (hour === null) return false;
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
      offset: now.offsetNameShort, // e.g., "GMT+2" or "GMT+3"
      isDST: now.isInDST,
      displayName: 'Israel Time'
    };
  }

  /**
   * Debug helper: Show conversion results
   */
  static debugDateConversion(ilDateString, endOfDay = false) {
    const utcDate = this.parseILToUTC(ilDateString, endOfDay);
    const ilDt = DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(IL_ZONE);
    
    console.log('Date Conversion Debug:');
    console.log('  Input (IL):', ilDateString);
    console.log('  Output (UTC JS Date):', utcDate.toISOString());
    console.log('  Verify (back to IL):', ilDt.toISO());
    console.log('  Offset:', ilDt.offsetNameShort);
    
    return utcDate;
  }
}

module.exports = { TimeUtils, IL_ZONE };