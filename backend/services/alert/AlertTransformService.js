// services/alert/AlertTransformService.js - Data transformation and enrichment
const { TimeUtils } = require('../../utils/TimeUtils');

/**
 * AlertTransformService - Responsible ONLY for data transformation
 * No business logic, no database access
 * 
 * Single Responsibility: Shape and enrich data for API responses
 */
class AlertTransformService {
  /**
   * Transform single alert record
   */
  transformAlertRecord(record, thresholds) {
    const ilHour = TimeUtils.getILHour(record.time_fired);

    return {
      id: record.incident_id,
      panel_title: record.panel_title,
      application: record.application,
      node_name: record.node_name,
      network: record.network,
      object: record.object,
      operator: record.operator,
      time_fired: TimeUtils.utcToIL(record.time_fired),
      time_resolved: TimeUtils.utcToIL(record.time_resolved),
      duration_sec: record.duration_sec,
      duration_category: this._categorizeDuration(record.duration_sec, thresholds),
      shift: this._determineShift(ilHour, thresholds),
      il_hour: ilHour,
      message: record.message,
      key_field: record.key_field,
      history_id: record.history_id
    };
  }

  /**
   * Transform multiple alert records (optimized with batching)
   */
  transformAlertRecords(records, thresholds) {
    if (!records || records.length === 0) {
      return [];
    }

    // Batch process timestamps for performance
    const uniqueTimestamps = [
      ...new Set(records.map(r => r.time_fired.getTime()))
    ];

    const hourMap = TimeUtils.batchGetILHours(
      uniqueTimestamps.map(ts => new Date(ts))
    );

    // Transform with cached hour lookups
    return records.map(record => {
      const timestamp = record.time_fired.getTime();
      const ilHour = hourMap.get(timestamp);

      return {
        id: record.incident_id,
        panel_title: record.panel_title,
        application: record.application,
        node_name: record.node_name,
        network: record.network,
        object: record.object,
        operator: record.operator,
        time_fired: TimeUtils.utcToIL(record.time_fired),
        time_resolved: TimeUtils.utcToIL(record.time_resolved),
        duration_sec: record.duration_sec,
        duration_category: this._categorizeDuration(record.duration_sec, thresholds),
        shift: this._determineShift(ilHour, thresholds),
        il_hour: ilHour,
        message: record.message,
        key_field: record.key_field,
        history_id: record.history_id,
        incident_number: record.incident_number,
        // Pass through clustering metadata if present
        is_cluster: !!record.is_cluster,
        cluster_count: record.cluster_count || 1,
        raw_alerts: record.raw_alerts || null
      };
    });
  }

  /**
   * Enrich panel stats with additional metadata
   */
  enrichPanelStats(stats, metadata = {}) {
    return stats.map(panel => ({
      ...panel,
      health_score: this._calculateHealthScore(panel),
      risk_level: this._determineRiskLevel(panel),
      ...metadata
    }));
  }

  /**
   * Format pagination metadata
   */
  formatPaginationMeta(records, page, limit) {
    const hasNext = records.length > limit;

    if (hasNext) {
      records = records.slice(0, limit);
    }

    return {
      records,
      pagination: {
        page,
        limit,
        hasNext,
        hasPrev: page > 1,
        returned: records.length
      }
    };
  }

  /**
   * Add date range to response metadata
   */
  addDateRangeMeta(data, params) {
    return {
      ...data,
      date_range: (params.start_date && params.end_date)
        ? {
          start: params.start_date,
          end: params.end_date,
          days: this._calculateDaysDiff(params.start_date, params.end_date)
        }
        : null
    };
  }

  /**
   * Format hourly heatmap with night indicators
   */
  formatHourlyHeatmap(heatmap, thresholds) {
    return heatmap.map(hour => ({
      ...hour,
      is_night: TimeUtils.isNightHour(
        hour.hour,
        thresholds.night_start,
        thresholds.night_end
      ),
      hour_display: `${String(hour.hour).padStart(2, '0')}:00`,
      formatted_avg_duration: TimeUtils.formatDuration(hour.avg_duration || 0)
    }));
  }

  /**
   * Format duration histogram with percentages
   */
  formatDurationHistogram(histogram, total) {
    return histogram.map(bucket => ({
      ...bucket,
      percentage: total > 0 ? ((bucket.count / total) * 100).toFixed(1) : '0.0'
    }));
  }

  /**
   * PRIVATE: Categorize alert duration
   */
  _categorizeDuration(durationSec, thresholds) {
    if (durationSec <= thresholds.dur_short_max) {
      return 'short';
    } else if (durationSec <= thresholds.dur_medium_max) {
      return 'medium';
    } else {
      return 'long';
    }
  }

  /**
   * PRIVATE: Determine shift (Day/Night)
   */
  _determineShift(hour, thresholds) {
    if (hour === null || hour === undefined) {
      return 'Unknown';
    }

    return TimeUtils.isDayHour(hour, thresholds.day_start, thresholds.day_end)
      ? 'Day'
      : 'Night';
  }

  /**
   * PRIVATE: Calculate health score (0-100)
   */
  _calculateHealthScore(panel) {
    const falsePositiveRate = panel.false_positive_count
      ? (panel.false_positive_count / panel.alert_count) * 100
      : 0;

    // Simple scoring: 100 - (false positive rate + volume penalty)
    const volumePenalty = Math.min(panel.alert_count / 10, 30);
    const score = Math.max(0, 100 - falsePositiveRate - volumePenalty);

    return Math.round(score);
  }

  /**
   * PRIVATE: Determine risk level based on metrics
   */
  _determineRiskLevel(panel) {
    const healthScore = this._calculateHealthScore(panel);

    if (healthScore >= 80) return 'low';
    if (healthScore >= 60) return 'medium';
    if (healthScore >= 40) return 'high';
    return 'critical';
  }

  /**
   * PRIVATE: Calculate days difference
   */
  _calculateDaysDiff(startDate, endDate) {
    if (!startDate || !endDate) return null;

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return null;
    }
  }

  /**
   * Sanitize and truncate message fields
   */
  sanitizeMessage(message, maxLength = 500) {
    if (!message) return null;

    let sanitized = String(message).trim();

    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...';
    }

    return sanitized;
  }

  /**
   * Format alert for external system (e.g., webhook)
   */
  formatForWebhook(alert) {
    return {
      alert_id: alert.id,
      panel: alert.panel_title,
      application: alert.application,
      node: alert.node_name,
      severity: alert.duration_category,
      timestamp: alert.time_fired,
      duration_seconds: alert.duration_sec,
      message: this.sanitizeMessage(alert.message, 200),
      shift: alert.shift
    };
  }
}

module.exports = { AlertTransformService };