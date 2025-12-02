// utils/QueryContextBuilder.js - Clean, immutable query building
const sql = require('mssql');
const { TimeUtils } = require('./TimeUtils');

/**
 * Immutable query context builder
 * Separates concerns: building WHERE conditions vs applying them to SQL requests
 */
class QueryContextBuilder {
  constructor(constants) {
    this.constants = constants;
    this.conditions = [];
    this.params = new Map();
  }

  /**
   * Add date range filter
   */
  addDateRange(startDate, endDate, maxDays = null) {
    const range = TimeUtils.validateDateRange(
      startDate, 
      endDate, 
      maxDays || this.constants.MAX_DATE_RANGE_DAYS
    );
    
    if (range?.start) {
      this.params.set('start_date_param', {
        type: sql.DateTime2,
        value: range.start
      });
      this.conditions.push('time_fired >= @start_date_param');
    }
    
    if (range?.end) {
      this.params.set('end_date_param', {
        type: sql.DateTime2,
        value: range.end
      });
      this.conditions.push('time_fired <= @end_date_param');
    }
    
    return this;
  }

  /**
   * Add single panel filter
   */
  addPanelFilter(panelTitle, required = false) {
    if (panelTitle) {
      this.params.set('panel_title_param', {
        type: sql.NVarChar,
        value: panelTitle
      });
      this.conditions.push('panel_title = @panel_title_param');
    } else if (required) {
      throw new Error('panel_title is required for this operation');
    }
    
    return this;
  }

  /**
   * Add array of panel titles (IN clause)
   */
  addPanelTitlesFilter(panelTitles) {
    if (!Array.isArray(panelTitles) || panelTitles.length === 0) {
      return this;
    }

    const placeholders = panelTitles.map((title, i) => {
      const paramName = `panel_title_${i}`;
      this.params.set(paramName, {
        type: sql.NVarChar,
        value: title
      });
      return `@${paramName}`;
    });

    this.conditions.push(`panel_title IN (${placeholders.join(', ')})`);
    return this;
  }

  /**
   * Add standard field filters (application, node_name, etc.)
   * Uses LIKE with prefix matching
   */
  addFieldFilters(fields) {
    const filterableFields = [
      'application',
      'node_name',
      'network',
      'object',
      'operator'
    ];

    filterableFields.forEach(field => {
      if (fields[field]) {
        const paramName = `${field}_param`;
        this.params.set(paramName, {
          type: sql.NVarChar,
          value: `${fields[field]}%`
        });
        this.conditions.push(`${field} LIKE @${paramName}`);
      }
    });

    return this;
  }

  /**
   * Add exact match field filter
   */
  addExactFieldFilter(fieldName, value) {
    if (value) {
      const paramName = `${fieldName}_exact_param`;
      this.params.set(paramName, {
        type: sql.NVarChar,
        value: value
      });
      this.conditions.push(`${fieldName} = @${paramName}`);
    }
    
    return this;
  }

  /**
   * Add duration range filter
   */
  addDurationFilter(minDuration, maxDuration) {
    if (minDuration !== undefined && minDuration !== null) {
      this.params.set('min_duration_param', {
        type: sql.Int,
        value: minDuration
      });
      this.conditions.push('duration_sec >= @min_duration_param');
    }

    if (maxDuration !== undefined && maxDuration !== null) {
      this.params.set('max_duration_param', {
        type: sql.Int,
        value: maxDuration
      });
      this.conditions.push('duration_sec <= @max_duration_param');
    }

    return this;
  }

  /**
   * Add custom condition with parameters
   */
  addCustomCondition(condition, params = {}) {
    this.conditions.push(condition);
    
    Object.entries(params).forEach(([name, config]) => {
      this.params.set(name, config);
    });
    
    return this;
  }

  /**
   * Add threshold parameters (for aggregation queries)
   */
  addThresholdParams(thresholds) {
    const thresholdParams = {
      dur_short_max: { type: sql.Int, value: thresholds.dur_short_max },
      dur_medium_max: { type: sql.Int, value: thresholds.dur_medium_max },
      false_wakeup_threshold: { type: sql.Int, value: thresholds.false_wakeup_threshold },
      day_start: { type: sql.Int, value: thresholds.day_start },
      day_end: { type: sql.Int, value: thresholds.day_end },
      night_start: { type: sql.Int, value: thresholds.night_start },
      night_end: { type: sql.Int, value: thresholds.night_end }
    };

    Object.entries(thresholdParams).forEach(([name, config]) => {
      this.params.set(name, config);
    });

    return this;
  }

  /**
   * Apply all parameters to SQL request object
   * This is the ONLY place we mutate the request
   */
  applyToRequest(sqlRequest) {
    for (const [name, param] of this.params) {
      sqlRequest.input(name, param.type, param.value);
    }
    return this;
  }

  /**
   * Get WHERE clause string
   */
  getWhereClause() {
    if (this.conditions.length === 0) {
      return '';
    }
    return `WHERE ${this.conditions.join(' AND ')}`;
  }

  /**
   * Get limit value with cap enforcement
   */
  getLimit(requestedLimit, defaultLimit = null) {
    const limit = requestedLimit || defaultLimit || this.constants.DEFAULT_CAP;
    return Math.min(limit, this.constants.DEFAULT_CAP);
  }

  /**
   * Add limit parameter to request
   */
  addLimitParam(sqlRequest, limit) {
    sqlRequest.input('limit_param', sql.Int, limit);
    return this;
  }

  /**
   * Add cap parameter to request (for TOP queries)
   */
  addCapParam(sqlRequest, cap) {
    sqlRequest.input('cap_param', sql.Int, cap);
    return this;
  }

  /**
   * Clone this builder (for reuse with modifications)
   */
  clone() {
    const cloned = new QueryContextBuilder(this.constants);
    cloned.conditions = [...this.conditions];
    cloned.params = new Map(this.params);
    return cloned;
  }

  /**
   * Get debug info (useful for logging)
   */
  getDebugInfo() {
    return {
      conditions: this.conditions,
      paramCount: this.params.size,
      paramNames: [...this.params.keys()],
      whereClause: this.getWhereClause()
    };
  }

  /**
   * Static factory method for common use case
   */
  static fromParams(params, constants, options = {}) {
    const builder = new QueryContextBuilder(constants);

    // Apply common filters
    builder.addDateRange(params.start_date, params.end_date);
    builder.addPanelFilter(params.panel_title, options.requirePanelTitle);
    builder.addFieldFilters(params);
    builder.addDurationFilter(params.min_duration, params.max_duration);

    if (params.panel_titles) {
      builder.addPanelTitlesFilter(params.panel_titles);
    }

    return builder;
  }
}

module.exports = { QueryContextBuilder };