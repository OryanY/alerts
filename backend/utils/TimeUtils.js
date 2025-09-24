// utils/TimeUtils.js - Centralized timezone and date handling
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
   * Get IL weekday (1=Mon .. 7=Sun) from UTC Date
   */
  static getILWeekday(utcDate) {
    if (!utcDate) return null;
    return DateTime.fromJSDate(utcDate, { zone: 'utc' }).setZone(IL_ZONE).weekday;
  }

  /**
   * Parse IL input string → UTC Date (endOfDay=true sets 23:59:59 IL)
   */
  static parseILToUTC(ilDateString, endOfDay = false) {
    if (!ilDateString) throw new Error('Date is required');

    // Allow either YYYY-MM-DD or full ISO
    const isYMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(ilDateString);
    let dt;
    
    if (isYMD) {
      dt = DateTime.fromISO(ilDateString, { zone: IL_ZONE });
      dt = endOfDay ? dt.endOf('day') : dt.startOf('day');
    } else {
      dt = DateTime.fromISO(ilDateString, { zone: IL_ZONE });
    }

    if (!dt.isValid) {
      throw new Error(`Invalid date format: ${ilDateString}. Use YYYY-MM-DD or ISO datetime`);
    }
    
    return dt.toUTC().toJSDate();
  }

  /**
   * Validate start/end IL-input → { start: UTC Date|null, end: UTC Date|null }
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
    return nightStart <= nightEnd
      ? (hour >= nightStart && hour < nightEnd)
      : (hour >= nightStart || hour < nightEnd);
  }

  /**
   * Check if hour is during day shift
   */
  static isDayHour(hour, dayStart, dayEnd) {
    return hour >= dayStart && hour < dayEnd;
  }

  /**
   * Get current IL date as ISO string
   */
  static getCurrentILDate() {
    return DateTime.now().setZone(IL_ZONE).toISODate();
  }

  /**
   * Get current IL time as ISO string
   */
  static getCurrentILTime() {
    return DateTime.now().setZone(IL_ZONE).toISO();
  }
}

module.exports = { TimeUtils, IL_ZONE };