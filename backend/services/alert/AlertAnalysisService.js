// services/alert/AlertAnalysisService.js - Pure analytics and computations
const { TimeUtils } = require('../../utils/TimeUtils');

/**
 * AlertAnalysisService - Responsible ONLY for data analysis and computations
 * No database access, no external dependencies
 * 
 * Single Responsibility: Transform raw data into insights
 */
class AlertAnalysisService {
  /**
   * Compute executive KPIs from raw records
   */
  computeKPIs(records, thresholds) {
    if (!records || records.length === 0) {
      return this._emptyKPIs();
    }

    const stats = {
      total: 0,
      sumDuration: 0,
      noise: 0,
      night: 0,
      trueWakeups: 0,
      falseWakeups: 0,
      durations: []
    };

    // Single pass through data
    for (const record of records) {
      stats.total++;
      stats.sumDuration += record.duration_sec;
      stats.durations.push(record.duration_sec);

      // Noise detection
      if (record.duration_sec <= thresholds.dur_short_max) {
        stats.noise++;
      }

      // Night shift analysis
      const hour = TimeUtils.getILHour(record.time_fired);
      const isNight = TimeUtils.isNightHour(hour, thresholds.night_start, thresholds.night_end);

      if (isNight) {
        stats.night++;
        
        if (record.duration_sec <= thresholds.false_wakeup_threshold) {
          stats.falseWakeups++;
        } else {
          stats.trueWakeups++;
        }
      }
    }

    return {
      total_alerts: stats.total,
      noise_alerts: stats.noise,
      night_alerts: stats.night,
      true_wakeups: stats.trueWakeups,
      false_wakeups: stats.falseWakeups,
      signal_ratio: this._calculatePercentage(stats.total - stats.noise, stats.total),
      false_wakeup_rate: this._calculatePercentage(
        stats.falseWakeups,
        stats.trueWakeups + stats.falseWakeups
      ),
      avg_duration: this._calculateAverage(stats.sumDuration, stats.total),
      median_duration: this._calculateMedian(stats.durations)
    };
  }

  /**
   * Compute timeseries statistics (by day)
   */
  computeTimeseries(records, thresholds) {
    if (!records || records.length === 0) {
      return [];
    }

    const dayMap = new Map();

    // Batch get IL dates for performance
    const uniqueDates = [...new Set(records.map(r => r.time_fired.getTime()))];
    const dateMap = TimeUtils.batchGetILDates(
      uniqueDates.map(ts => new Date(ts))
    );
    const hourMap = TimeUtils.batchGetILHours(
      uniqueDates.map(ts => new Date(ts))
    );

    for (const record of records) {
      const timestamp = record.time_fired.getTime();
      const ilDate = dateMap.get(timestamp);
      const hour = hourMap.get(timestamp);
      
      if (!ilDate) continue;

      let stats = dayMap.get(ilDate);
      if (!stats) {
        stats = { count: 0, sum: 0, day: 0, night: 0 };
        dayMap.set(ilDate, stats);
      }

      stats.count++;
      stats.sum += record.duration_sec;

      const isDay = TimeUtils.isDayHour(hour, thresholds.day_start, thresholds.day_end);
      if (isDay) {
        stats.day++;
      } else {
        stats.night++;
      }
    }

    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({
        date_il: date,
        alert_count: stats.count,
        avg_duration: this._calculateAverage(stats.sum, stats.count),
        day_count: stats.day,
        night_count: stats.night
      }));
  }

  /**
   * Compute hourly statistics with duration breakdown
   */
  computeHourlyStats(records, thresholds) {
    if (!records || records.length === 0) {
      return this._emptyHourlyStats();
    }

    // Pre-allocate buckets for all 24 hours
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: 0,
      sum: 0,
      short: 0,
      medium: 0,
      long: 0
    }));

    // Batch get hours for performance
    const uniqueDates = [...new Set(records.map(r => r.time_fired.getTime()))];
    const hourMap = TimeUtils.batchGetILHours(
      uniqueDates.map(ts => new Date(ts))
    );

    for (const record of records) {
      const timestamp = record.time_fired.getTime();
      const hour = hourMap.get(timestamp);
      
      if (hour === null || hour < 0 || hour >= 24) continue;

      const bucket = buckets[hour];
      bucket.count++;
      bucket.sum += record.duration_sec;

      // Duration categorization
      if (record.duration_sec <= thresholds.dur_short_max) {
        bucket.short++;
      } else if (record.duration_sec <= thresholds.dur_medium_max) {
        bucket.medium++;
      } else {
        bucket.long++;
      }
    }

    return buckets.map(b => ({
      hour: b.hour,
      hour_display: `${String(b.hour).padStart(2, '0')}:00`,
      alert_count: b.count,
      avg_duration: this._calculateAverage(b.sum, b.count),
      short_alerts: b.short,
      medium_alerts: b.medium,
      long_alerts: b.long
    }));
  }

  /**
   * Compute detailed panel analysis
   */
  computePanelAnalysis(records, thresholds) {
    if (!records || records.length === 0) {
      return this._emptyPanelAnalysis();
    }

    // Batch get timestamps for performance
    const uniqueDates = [...new Set(records.map(r => r.time_fired.getTime()))];
    const dateMap = TimeUtils.batchGetILDates(
      uniqueDates.map(ts => new Date(ts))
    );
    const hourMap = TimeUtils.batchGetILHours(
      uniqueDates.map(ts => new Date(ts))
    );

    // Single-pass aggregation
    const agg = {
      total: 0,
      sum: 0,
      short: 0,
      medium: 0,
      long: 0,
      falsePositives: 0,
      nightAlerts: 0,
      nightWakeups: 0,
      nightFalseWakeups: 0,
      dayAlerts: 0,
      hourly: Array.from({ length: 24 }, () => ({ count: 0, sum: 0 })),
      daily: new Map(),
      messages: new Map()
    };

    for (const record of records) {
      const timestamp = record.time_fired.getTime();
      const hour = hourMap.get(timestamp);
      const date = dateMap.get(timestamp);
      
      agg.total++;
      agg.sum += record.duration_sec;

      // Duration buckets
      if (record.duration_sec <= thresholds.dur_short_max) {
        agg.short++;
      } else if (record.duration_sec <= thresholds.dur_medium_max) {
        agg.medium++;
      } else {
        agg.long++;
      }

      // False positives
      if (record.duration_sec <= thresholds.false_wakeup_threshold) {
        agg.falsePositives++;
      }

      // Shift analysis
      const isNight = TimeUtils.isNightHour(hour, thresholds.night_start, thresholds.night_end);
      
      if (isNight) {
        agg.nightAlerts++;
        if (record.duration_sec > thresholds.false_wakeup_threshold) {
          agg.nightWakeups++;
        } else {
          agg.nightFalseWakeups++;
        }
      } else {
        agg.dayAlerts++;
      }

      // Hourly distribution
      if (hour !== null && hour >= 0 && hour < 24) {
        agg.hourly[hour].count++;
        agg.hourly[hour].sum += record.duration_sec;
      }

      // Daily trend
      if (date) {
        agg.daily.set(date, (agg.daily.get(date) || 0) + 1);
      }

      // Message breakdown
      if (record.message) {
        let msgStats = agg.messages.get(record.message);
        if (!msgStats) {
          msgStats = { count: 0, sum: 0, falsePos: 0 };
          agg.messages.set(record.message, msgStats);
        }
        msgStats.count++;
        msgStats.sum += record.duration_sec;
        if (record.duration_sec <= thresholds.false_wakeup_threshold) {
          msgStats.falsePos++;
        }
      }
    }

    // Format results
    return this._formatPanelAnalysis(agg, thresholds);
  }

  /**
   * Helper: Calculate percentage safely
   */
  _calculatePercentage(numerator, denominator) {
    if (!denominator) return 0;
    return parseFloat(((numerator * 100) / denominator).toFixed(1));
  }

  /**
   * Helper: Calculate average safely
   */
  _calculateAverage(sum, count) {
    if (!count) return 0;
    return parseFloat((sum / count).toFixed(2));
  }

  /**
   * Helper: Calculate median
   */
  _calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Helper: Format panel analysis results
   */
  _formatPanelAnalysis(agg, thresholds) {
    const dailyTrend = Array.from(agg.daily.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const trendDirection = this._calculateTrendDirection(dailyTrend);

    const hourlyHeatmap = agg.hourly.map((h, hour) => ({
      hour,
      count: h.count,
      avg_duration: this._calculateAverage(h.sum, h.count),
      is_night: TimeUtils.isNightHour(hour, thresholds.night_start, thresholds.night_end)
    }));

    const topNoisyAlerts = Array.from(agg.messages.entries())
      .map(([message, stats]) => ({
        message,
        count: stats.count,
        avg_duration: this._calculateAverage(stats.sum, stats.count),
        false_positive_rate: this._calculatePercentage(stats.falsePos, stats.count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const daysInRange = dailyTrend.length || 1;

    return {
      summary: {
        total_alerts: agg.total,
        avg_duration: this._calculateAverage(agg.sum, agg.total),
        false_positive_count: agg.falsePositives,
        false_positive_rate: this._calculatePercentage(agg.falsePositives, agg.total),
        night_alerts: agg.nightAlerts,
        night_wakeups: agg.nightWakeups,
        night_false_wakeups: agg.nightFalseWakeups,
        day_alerts: agg.dayAlerts,
        alerts_per_day: parseFloat((agg.total / daysInRange).toFixed(2)),
        trend_direction: trendDirection
      },
      duration_distribution: [
        { category: 'Short', range: `≤${thresholds.dur_short_max}s`, count: agg.short },
        { category: 'Medium', range: `${thresholds.dur_short_max + 1}-${thresholds.dur_medium_max}s`, count: agg.medium },
        { category: 'Long', range: `>${thresholds.dur_medium_max}s`, count: agg.long }
      ],
      daily_trend: dailyTrend,
      hourly_heatmap: hourlyHeatmap,
      top_noisy_alerts: topNoisyAlerts
    };
  }

  /**
   * Helper: Calculate trend direction
   */
  _calculateTrendDirection(dailyTrend) {
    if (dailyTrend.length < 4) return 'stable';

    const mid = Math.floor(dailyTrend.length / 2);
    const firstHalf = dailyTrend.slice(0, mid);
    const secondHalf = dailyTrend.slice(mid);

    const avg1 = firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length;

    const changePercent = avg1 ? ((avg2 - avg1) / avg1) * 100 : 0;

    if (changePercent > 15) return 'increasing';
    if (changePercent < -15) return 'decreasing';
    return 'stable';
  }

  /**
   * Empty states for consistent API
   */
  _emptyKPIs() {
    return {
      total_alerts: 0,
      noise_alerts: 0,
      night_alerts: 0,
      true_wakeups: 0,
      false_wakeups: 0,
      signal_ratio: 0,
      false_wakeup_rate: 0,
      avg_duration: 0,
      median_duration: 0
    };
  }

  _emptyHourlyStats() {
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      hour_display: `${String(hour).padStart(2, '0')}:00`,
      alert_count: 0,
      avg_duration: 0,
      short_alerts: 0,
      medium_alerts: 0,
      long_alerts: 0
    }));
  }

  _emptyPanelAnalysis() {
    return {
      summary: {
        total_alerts: 0,
        avg_duration: 0,
        false_positive_count: 0,
        false_positive_rate: 0,
        night_alerts: 0,
        night_wakeups: 0,
        night_false_wakeups: 0,
        day_alerts: 0,
        alerts_per_day: 0,
        trend_direction: 'stable'
      },
      duration_distribution: [],
      daily_trend: [],
      hourly_heatmap: [],
      top_noisy_alerts: []
    };
  }
}

module.exports = { AlertAnalysisService };