// services/alert/AlertRecommendationService.js - Business intelligence and recommendations
/**
 * AlertRecommendationService - Responsible ONLY for generating actionable recommendations
 * No database access, no analytics computation
 * 
 * Single Responsibility: Transform metrics into business insights
 */
class AlertRecommendationService {
  /**
   * Generate recommendations based on panel analysis
   */
  generateRecommendations(metrics, thresholds) {
    const {
      summary,
      topNoisyAlerts = [],
      hourlyHeatmap = []
    } = metrics;

    if (!summary || summary.total_alerts === 0) {
      return [];
    }

    const recommendations = [];

    // 1. High False Positive Rate
    this._checkFalsePositiveRate(summary, thresholds, recommendations);

    // 2. Night Operations Impact
    this._checkNightOperations(summary, recommendations);

    // 3. Volume and Trend Analysis
    this._checkVolumeTrends(summary, recommendations);

    // 4. Concentrated Noise Sources
    this._checkConcentratedNoise(summary, topNoisyAlerts, recommendations);

    // 5. Time Pattern Analysis
    this._checkTimePatterns(hourlyHeatmap, summary, recommendations);

    // 6. Healthy State
    if (recommendations.length === 0) {
      this._addHealthyState(summary, recommendations);
    }

    return recommendations;
  }

  /**
   * Check for high false positive rates
   */
  _checkFalsePositiveRate(summary, thresholds, recommendations) {
    const fpRate = summary.false_positive_rate || 0;

    if (fpRate > 60) {
      recommendations.push({
        severity: 'high',
        category: 'threshold',
        message: `${fpRate.toFixed(1)}% of alerts are false positives (<${thresholds.false_wakeup_threshold}s)`,
        action: 'Increase alert thresholds and/or implement correlation rules to reduce noise',
        impact: 'High team disruption with low-value alerts',
        priority: 1
      });
    } else if (fpRate > 40) {
      recommendations.push({
        severity: 'medium',
        category: 'threshold',
        message: `${fpRate.toFixed(1)}% false positive rate`,
        action: 'Review alert thresholds for top noisy sources',
        impact: 'Moderate noise affecting team efficiency',
        priority: 2
      });
    } else if (fpRate > 20) {
      recommendations.push({
        severity: 'low',
        category: 'threshold',
        message: `${fpRate.toFixed(1)}% false positive rate`,
        action: 'Monitor and fine-tune alert thresholds as needed',
        impact: 'Acceptable noise level but room for improvement',
        priority: 4
      });
    }
  }

  /**
   * Check night operations impact
   */
  _checkNightOperations(summary, recommendations) {
    const nightFalseWakeups = summary.night_false_wakeups || 0;
    const nightWakeups = summary.night_wakeups || 0;

    if (nightFalseWakeups > 20) {
      recommendations.push({
        severity: 'high',
        category: 'night-operations',
        message: `${nightFalseWakeups} false night wakeups detected`,
        action: 'Implement night-specific thresholds or suppress non-critical alerts during night hours',
        impact: 'Team fatigue and reduced on-call effectiveness',
        priority: 1
      });
    }

    if (nightWakeups > 50) {
      recommendations.push({
        severity: 'medium',
        category: 'night-operations',
        message: `${nightWakeups} legitimate night wakeups (high frequency)`,
        action: 'Investigate automation opportunities to reduce night incidents',
        impact: 'High on-call load affecting team morale',
        priority: 2
      });
    } else if (nightWakeups > 30) {
      recommendations.push({
        severity: 'low',
        category: 'night-operations',
        message: `${nightWakeups} night wakeups`,
        action: 'Review if any incidents can be auto-remediated',
        impact: 'Moderate on-call burden',
        priority: 3
      });
    }
  }

  /**
   * Check volume and trend patterns
   */
  _checkVolumeTrends(summary, recommendations) {
    const alertsPerDay = summary.alerts_per_day || 0;
    const trendDirection = summary.trend_direction || 'stable';

    // Trend analysis
    if (trendDirection === 'increasing') {
      recommendations.push({
        severity: 'medium',
        category: 'trend',
        message: 'Alert volume is trending upward',
        action: 'Investigate possible system degradation or new failure patterns',
        impact: 'Increasing operational burden',
        priority: 2
      });
    } else if (trendDirection === 'decreasing') {
      recommendations.push({
        severity: 'low',
        category: 'trend',
        message: 'Alert volume is trending downward',
        action: 'Continue current improvement practices',
        impact: 'Positive trend - system health improving',
        priority: 5
      });
    }

    // Volume analysis
    if (alertsPerDay > 100) {
      recommendations.push({
        severity: 'high',
        category: 'velocity',
        message: `${alertsPerDay.toFixed(1)} alerts per day`,
        action: 'Urgent: Review alert definitions and implement aggregation rules',
        impact: 'Severe alert fatigue - critical alerts may be missed',
        priority: 1
      });
    } else if (alertsPerDay > 50) {
      recommendations.push({
        severity: 'medium',
        category: 'velocity',
        message: `${alertsPerDay.toFixed(1)} alerts per day`,
        action: 'Review alert definitions and aggregation rules',
        impact: 'Alert fatigue risk',
        priority: 2
      });
    }
  }

  /**
   * Check for concentrated noise sources
   */
  _checkConcentratedNoise(summary, topNoisyAlerts, recommendations) {
    if (!topNoisyAlerts || topNoisyAlerts.length === 0) return;

    const total = summary.total_alerts || 1;
    const topAlert = topNoisyAlerts[0];
    const topPercentage = (topAlert.count / total) * 100;

    if (topPercentage > 40) {
      recommendations.push({
        severity: 'high',
        category: 'noise-concentration',
        message: `Single alert "${topAlert.message}" accounts for ${topPercentage.toFixed(1)}% of all alerts`,
        action: 'Prioritize fixing or tuning this specific alert immediately',
        impact: 'Extreme noise from single source masking other issues',
        priority: 1
      });
    } else if (topPercentage > 25) {
      recommendations.push({
        severity: 'medium',
        category: 'noise-concentration',
        message: `Alert "${topAlert.message}" accounts for ${topPercentage.toFixed(1)}% of volume`,
        action: 'Review and optimize this high-frequency alert',
        impact: 'Significant noise from single source',
        priority: 2
      });
    }

    // Check top 3 combined
    const top3Count = topNoisyAlerts.slice(0, 3).reduce((sum, a) => sum + a.count, 0);
    const top3Percentage = (top3Count / total) * 100;

    if (top3Percentage > 70) {
      recommendations.push({
        severity: 'medium',
        category: 'noise-concentration',
        message: `Top 3 alerts account for ${top3Percentage.toFixed(1)}% of total volume`,
        action: 'Focus optimization efforts on these three high-impact alerts',
        impact: 'Noise concentrated in few sources - high optimization potential',
        priority: 2
      });
    }
  }

  /**
   * Check time-based patterns
   */
  _checkTimePatterns(hourlyHeatmap, summary, recommendations) {
    if (!hourlyHeatmap || hourlyHeatmap.length === 0) return;

    const nightHours = hourlyHeatmap.filter(h => h.is_night);
    const nightTotal = nightHours.reduce((sum, h) => sum + h.count, 0);

    if (nightTotal === 0) return;

    // Find peak night hour
    const peak = nightHours.reduce((prev, curr) => 
      curr.count > prev.count ? curr : prev,
      nightHours[0]
    );

    const peakPercentage = (peak.count / nightTotal) * 100;

    if (peakPercentage > 40) {
      recommendations.push({
        severity: 'medium',
        category: 'time-pattern',
        message: `Peak night activity at ${peak.hour}:00 with ${peak.count} alerts (${peakPercentage.toFixed(1)}% of night total)`,
        action: 'Investigate scheduled jobs, backups, or batch processes around this time',
        impact: 'Predictable disruption pattern - likely preventable',
        priority: 2
      });
    }

    // Check for consistent night patterns
    const nightHoursAbove5 = nightHours.filter(h => h.count > 5).length;
    if (nightHoursAbove5 > 4) {
      recommendations.push({
        severity: 'low',
        category: 'time-pattern',
        message: `Consistent night-time alert patterns across ${nightHoursAbove5} hours`,
        action: 'Consider implementing time-based alert suppression or escalation policies',
        impact: 'Ongoing night disruption',
        priority: 3
      });
    }
  }

  /**
   * Add healthy state recommendation
   */
  _addHealthyState(summary, recommendations) {
    const fpRate = summary.false_positive_rate || 0;
    const nightWakeups = summary.night_wakeups || 0;

    if (fpRate < 20 && nightWakeups < 20) {
      recommendations.push({
        severity: 'low',
        category: 'health',
        message: 'Panel health looks good',
        action: 'Maintain current alert configuration and practices',
        impact: 'Well-tuned alerting with good signal-to-noise ratio',
        priority: 5
      });
    }
  }

  /**
   * Sort recommendations by priority
   */
  sortByPriority(recommendations) {
    return [...recommendations].sort((a, b) => {
      // First by priority
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by severity
      const severityOrder = { high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });
  }

  /**
   * Filter recommendations by severity
   */
  filterBySeverity(recommendations, minSeverity = 'low') {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const minLevel = severityOrder[minSeverity] || 1;

    return recommendations.filter(rec => 
      (severityOrder[rec.severity] || 1) >= minLevel
    );
  }
}

module.exports = { AlertRecommendationService };