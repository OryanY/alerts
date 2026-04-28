// schemas/alertSchemas.js - Joi validation schemas for alert endpoints
const Joi = require('joi');

// Base schema for common parameters
const baseSchema = {
  start_date: Joi.string().pattern(/^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/).optional(),
  end_date: Joi.string().pattern(/^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/).optional(),
  // Configuration parameters with defaults
  day_start: Joi.number().integer().min(0).max(23).default(8),
  day_end: Joi.number().integer().min(0).max(23).default(22),
  night_start: Joi.number().integer().min(0).max(23).default(22),
  night_end: Joi.number().integer().min(0).max(23).default(8),
  // Duration thresholds
  dur_short_max: Joi.number().integer().min(1).default(30),
  dur_medium_max: Joi.number().integer().min(1).default(300),
  false_wakeup_threshold: Joi.number().integer().min(1).default(120),

  // Limit parameter
  limit: Joi.number().integer().min(1).max(100000).default(10000),

  // Clustering Configuration
  clustering_enabled: Joi.boolean().optional(),
  clustering_threshold: Joi.number().integer().min(1).max(1440).optional(),
  duration_metric: Joi.string().valid('average', 'median').default('average').optional(),
  has_incident: Joi.boolean().optional()
};

// Schema for main alerts endpoint with filtering and pagination
const alertsSchema = Joi.object({
  ...baseSchema,

  // Pagination
  page: Joi.number().integer().min(1).optional(),

  // Sorting
  sort_by: Joi.string().valid(
    'time_fired', 'time_resolved', 'duration_sec',
    'panel_title', 'application', 'node_name', 'operator',
    'message', 'object', 'network'
  ).default('time_fired'),
  sort_order: Joi.string().valid('ASC', 'DESC').default('DESC'),
  // Field filters
  panel_title: Joi.string().trim().max(100).optional(),
  application: Joi.string().trim().max(100).optional(),
  node_name: Joi.string().trim().max(100).optional(),
  network: Joi.string().trim().max(100).optional(),
  object: Joi.string().trim().max(100).optional(),
  operator: Joi.string().trim().max(50).optional(),

  // Duration filters
  min_duration: Joi.number().integer().min(0).optional(),
  max_duration: Joi.number().integer().min(0).optional(),
  
  // Text Search
  search: Joi.string().trim().max(200).optional()
}).custom((value, helpers) => {
  // Validate duration range
  if (value.min_duration !== undefined && value.max_duration !== undefined) {
    if (value.min_duration >= value.max_duration) {
      return helpers.error('any.invalid', { message: 'min_duration must be strictly less than max_duration' });
    }
  }

  // Validate shift hours
  if (value.day_start >= value.day_end) {
    return helpers.error('any.invalid', { message: 'day_start must be less than day_end' });
  }

  return value;
});


const panelResearchSchema = Joi.object({
  start_date: Joi.string().pattern(/^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/).optional(),
  end_date: Joi.string().pattern(/^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/).optional(),
  panel_title: Joi.string().optional().allow(''),
  false_wakeup_threshold: Joi.number().integer().min(1).max(3600).optional(),
  day_start: Joi.number().integer().min(0).max(23).optional(),
  day_end: Joi.number().integer().min(0).max(23).optional(),
  night_start: Joi.number().integer().min(0).max(23).optional(),
  night_end: Joi.number().integer().min(0).max(23).optional(),
  dur_short_max: Joi.number().integer().min(1).max(3600).optional(),
  dur_medium_max: Joi.number().integer().min(1).max(3600).optional(),
  limit: Joi.number().integer().min(1).max(100000).optional(),
  clustering_enabled: Joi.boolean().optional(),
  clustering_threshold: Joi.number().integer().min(1).max(1440).optional()
});

// Schema for statistics endpoints
const statsSchema = Joi.object({
  ...baseSchema,
  panel_title: Joi.string().trim().max(100).optional()

}).custom((value, helpers) => {
  // Validate shift hours
  if (value.day_start >= value.day_end) {
    return helpers.error('any.invalid', { message: 'day_start must be less than day_end' });
  }

  return value;
});

// Schema for panel statistics with additional limit options
const panelStatsSchema = Joi.object({
  ...baseSchema,
  limit: Joi.number().integer().min(1).max(500).default(50) // Lower default for panel stats
});

// Schema for time series data
const timeseriesSchema = Joi.object({
  ...baseSchema,
  panel_title: Joi.string().trim().max(100).optional(),
  // Time series specific parameters
  granularity: Joi.string().valid('hour', 'day').default('day'),
  fill_gaps: Joi.boolean().default(false)
}).custom((value, helpers) => {
  // Validate date range is required for time series
  if (!value.start_date || !value.end_date) {
    return helpers.error('any.invalid', {
      message: 'Both start_date and end_date are required for time series data'
    });
  }

  return value;
});


module.exports = {
  alertsSchema,
  statsSchema,
  panelStatsSchema,
  timeseriesSchema,
  panelResearchSchema,
};