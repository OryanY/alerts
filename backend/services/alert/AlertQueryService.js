// services/alert/AlertQueryService.js - Pure data access layer (no business logic)
const sql = require('mssql');
const { SqlTemplates, SqlBuilder } = require('../../utils/SqlTemplates');
const { QueryContextBuilder } = require('../../utils/QueryContextBuilder');

/**
 * AlertQueryService - Responsible ONLY for database queries
 * No business logic, no data transformation, no analytics
 * 
 * Single Responsibility: Execute SQL queries and return raw results
 */
class AlertQueryService {
  constructor(sqlPool, constants) {
    this.pool = sqlPool;
    this.constants = constants;
  }

  /**
   * Fetch alerts with filtering, sorting, and pagination
   */
  async fetchAlerts(params) {
    const request = this.pool.request();

    // Build query context
    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.applyToRequest(request);

    // Build SQL
    const whereClause = context.getWhereClause();
    const sortBy = this._validateSortField(params.sort_by || 'time_fired');
    const sortOrder = params.sort_order === 'ASC' ? 'ASC' : 'DESC';

    let topClause = '';
    let paginationClause = '';

    if (params.page && params.limit) {
      // Pagination mode
      const limit = Math.min(params.limit, this.constants.MAX_PAGE_SIZE);
      request.input('limit_param', sql.Int, limit + 1); // +1 for hasNext detection
      paginationClause = SqlTemplates.buildPaginationClause(params.page, limit);
    } else {
      // Simple limit mode
      const limit = context.getLimit(params.limit);
      request.input('limit_param', sql.Int, limit);
      topClause = 'TOP (@limit_param)';
    }

    const sqlQuery = new SqlBuilder(SqlTemplates.SELECT_ALERTS)
      .replace('TOP_CLAUSE', topClause)
      .replace('WHERE_CLAUSE', whereClause)
      .replace('ORDER_CLAUSE', `ORDER BY ${sortBy} ${sortOrder}`)
      .replace('PAGINATION_CLAUSE', paginationClause)
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch basic records for analytics (minimal fields for performance)
   */
  async fetchBasicRecords(params, fields = 'time_fired, duration_sec') {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    const cap = context.getLimit(params.limit);

    context.applyToRequest(request);
    context.addCapParam(request, cap);

    const sqlQuery = new SqlBuilder(SqlTemplates.SELECT_BASIC_RECORDS)
      .replace('FIELDS', fields)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch hourly heatmap data using optimized SQL
   */
  async fetchHourlyHeatmap(params) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.applyToRequest(request);

    const sqlQuery = new SqlBuilder(SqlTemplates.HOURLY_HEATMAP)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch duration histogram using SQL aggregation
   */
  async fetchDurationHistogram(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    const sqlQuery = new SqlBuilder(SqlTemplates.DURATION_HISTOGRAM)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset[0];
  }

  /**
   * Fetch shift analysis using SQL aggregation
   */
  async fetchShiftAnalysis(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    const sqlQuery = new SqlBuilder(SqlTemplates.SHIFT_ANALYSIS)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch overview statistics using SQL aggregation
   */
  async fetchOverviewStats(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    const sqlQuery = new SqlBuilder(SqlTemplates.OVERVIEW_STATS)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset[0];
  }

  /**
   * Fetch panel list with aggregates
   */
  async fetchPanelList(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    const sqlQuery = new SqlBuilder(SqlTemplates.PANEL_LIST)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch panel statistics grouped by panel + application
   */
  async fetchPanelStats(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    const topClause = params.limit
      ? SqlTemplates.buildTopClause(params.limit)
      : '';

    if (params.limit) {
      request.input('limit_param', sql.Int, params.limit);
    }

    const sqlQuery = new SqlBuilder(SqlTemplates.PANEL_STATS)
      .replace('TOP_CLAUSE', topClause)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch top noisy nodes
   */
  async fetchTopNoisyNodes(params) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    const limit = Math.min(params.limit || 10, 50);

    context.applyToRequest(request);
    request.input('limit_param', sql.Int, limit);

    const sqlQuery = new SqlBuilder(SqlTemplates.TOP_NOISY_NODES)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch alert message breakdown
   */
  async fetchMessageBreakdown(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants, {
      requirePanelTitle: true
    });
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    const sqlQuery = new SqlBuilder(SqlTemplates.ALERT_MESSAGE_BREAKDOWN)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Count total alerts matching criteria
   */
  async countAlerts(params) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.applyToRequest(request);

    const sqlQuery = new SqlBuilder(SqlTemplates.COUNT_ALERTS)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset[0].total;
  }

  /**
   * Fetch top applications per panel
   */
  async fetchTopApplicationsPerPanel(params) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    const limit = Math.min(params.limit || 10, 50);

    context.applyToRequest(request);
    request.input('limit_param', sql.Int, limit);

    const sqlQuery = new SqlBuilder(SqlTemplates.TOP_APPLICATIONS)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch top nodes per application
   */
  async fetchTopNodesPerApplication(params) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    const limit = Math.min(params.limit || 10, 50);

    context.applyToRequest(request);
    request.input('limit_param', sql.Int, limit);

    const sqlQuery = new SqlBuilder(SqlTemplates.TOP_NODES_BY_APP)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch nodes with consecutive days of alerts
   */
  async fetchConsecutiveDaysNodes(params) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    const limit = Math.min(params.limit || 10, 50);

    context.applyToRequest(request);
    request.input('limit_param', sql.Int, limit);

    const sqlQuery = new SqlBuilder(SqlTemplates.CONSECUTIVE_DAYS_NODES)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  // ============ CLUSTERED QUERY METHODS ============

  /**
   * Fetch clustered KPI statistics (total clusters, avg duration, false wakeups)
   */
  async fetchClusteredKPIs(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    // Add clustering threshold parameter
    request.input('cluster_threshold', sql.Int, params.cluster_threshold || 15);

    const sqlQuery = new SqlBuilder(SqlTemplates.CLUSTERED_KPI_STATS)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset[0];
  }

  /**
   * Fetch clustered hourly heatmap
   */
  async fetchClusteredHourlyHeatmap(params) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.applyToRequest(request);

    request.input('cluster_threshold', sql.Int, params.cluster_threshold || 15);

    const sqlQuery = new SqlBuilder(SqlTemplates.CLUSTERED_HOURLY_HEATMAP)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch clustered duration histogram
   */
  async fetchClusteredDurationHistogram(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    request.input('cluster_threshold', sql.Int, params.cluster_threshold || 15);

    const sqlQuery = new SqlBuilder(SqlTemplates.CLUSTERED_DURATION_HISTOGRAM)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset[0];
  }

  /**
   * Fetch clustered shift analysis (day vs night)
   */
  async fetchClusteredShiftAnalysis(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    request.input('cluster_threshold', sql.Int, params.cluster_threshold || 15);

    const sqlQuery = new SqlBuilder(SqlTemplates.CLUSTERED_SHIFT_ANALYSIS)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Fetch clustered timeseries (daily cluster counts)
   */
  async fetchClusteredTimeseries(params, thresholds) {
    const request = this.pool.request();

    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.addThresholdParams(thresholds);
    context.applyToRequest(request);

    request.input('cluster_threshold', sql.Int, params.cluster_threshold || 15);

    const sqlQuery = new SqlBuilder(SqlTemplates.CLUSTERED_TIMESERIES)
      .replace('WHERE_CLAUSE', context.getWhereClause())
      .build();

    const result = await request.query(sqlQuery);
    return result.recordset;
  }

  /**
   * Validate sort field against whitelist
   */
  _validateSortField(field) {
    const allowedFields = [
      'time_fired',
      'time_resolved',
      'duration_sec',
      'panel_title',
      'application',
      'node_name',
      'operator',
      'message',
      'object',
      'network'
    ];

    if (!allowedFields.includes(field)) {
      throw new Error(`Invalid sort field: ${field}`);
    }

    return field;
  }
}

module.exports = { AlertQueryService };