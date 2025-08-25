import { useState, useCallback, memo, useMemo } from 'react';
import './Filters.css';

const Filters = memo(({ filters, setFilters }) => {
  const [open, setOpen] = useState(false);

  const set = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, [setFilters]);

  // Auto-normalize durations during typing
  const normalizeOnChange = useCallback((field, value) => {
    const otherField = field === 'min_duration' ? 'max_duration' : 'min_duration';
    const otherValue = filters[otherField];
    
    if (value !== '' && otherValue !== '') {
      const newVal = Number(value);
      const otherVal = Number(otherValue);
      
      if (field === 'min_duration' && newVal > otherVal) {
        // If setting min higher than max, increase max to match
        set({ [field]: value, max_duration: newVal });
        return;
      } else if (field === 'max_duration' && newVal < otherVal) {
        // If setting max lower than min, decrease min to match
        set({ [field]: value, min_duration: newVal });
        return;
      }
    }
    
    set({ [field]: value });
  }, [filters.min_duration, filters.max_duration, set]);

  const update = useCallback((field) => (e) => {
    const value = e.target.value;
    if (field === 'min_duration' || field === 'max_duration') {
      const v = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
      normalizeOnChange(field, v === 0 ? '' : v);
      return;
    }
    set({ [field]: value });
  }, [set, normalizeOnChange]);

  const clear = useCallback(() => {
    set({
      panel_title: '',
      application: '',
      node_name: '',
      network: '',
      object: '',
      operator: '',
      min_duration: '',
      max_duration: '',
      start_date: '',
      end_date: '',
    });
  }, [set]);

  const handleDateTimeChange = useCallback((field) => (e) => {
    const value = e.target.value;
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        set({ [field]: date.toISOString() });
      }
    } else {
      set({ [field]: '' });
    }
  }, [set]);

  const formatDatetimeLocal = useMemo(() => (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      // Convert to local timezone for the datetime-local input
      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return localDate.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  }, []);

  // Normalize durations if inverted (min > max)
  const normalizeDurations = useCallback(() => {
    const min = filters.min_duration === '' ? null : Number(filters.min_duration);
    const max = filters.max_duration === '' ? null : Number(filters.max_duration);
    if (min != null && max != null && min > max) {
      set({ min_duration: max, max_duration: min });
    }
  }, [filters.min_duration, filters.max_duration, set]);

  // Normalize dates if start > end
  const normalizeDates = useCallback(() => {
    if (filters.start_date && filters.end_date) {
      const start = new Date(filters.start_date);
      const end = new Date(filters.end_date);
      if (start > end) {
        set({ start_date: filters.end_date, end_date: filters.start_date });
      }
    }
  }, [filters.start_date, filters.end_date, set]);

  // Count active filters for better UX
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== '' && value != null).length;
  }, [filters]);

  return (
    <div className="filters card">
      <div className="filters-header">
        <h3 className="filters-title">
          Filters {activeFilterCount > 0 && <span className="filter-count">({activeFilterCount})</span>}
        </h3>
        <button
          className="btn btn-primary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filters-content"
          aria-label={open ? 'Hide filters' : 'Show filters'}
        >
          {open ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {open && (
        <div id="filters-content" className="filters-grid">
          <div className="form-group">
            <label htmlFor="f-panel">Panel Title</label>
            <input
              id="f-panel"
              className="input"
              value={filters.panel_title || ''}
              onChange={update('panel_title')}
              placeholder="Search panel..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-app">Application</label>
            <input
              id="f-app"
              className="input"
              value={filters.application || ''}
              onChange={update('application')}
              placeholder="Search application..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-node">Node Name</label>
            <input
              id="f-node"
              className="input"
              value={filters.node_name || ''}
              onChange={update('node_name')}
              placeholder="Search node..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-network">Network</label>
            <input
              id="f-network"
              className="input"
              value={filters.network || ''}
              onChange={update('network')}
              placeholder="Search network..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-object">Object</label>
            <input
              id="f-object"
              className="input"
              value={filters.object || ''}
              onChange={update('object')}
              placeholder="Search object..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-operator">Operator</label>
            <input
              id="f-operator"
              className="input"
              value={filters.operator || ''}
              onChange={update('operator')}
              placeholder="Search operator..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-min">Min Duration (sec)</label>
            <input
              id="f-min"
              className="input"
              type="number"
              min="0"
              step="1"
              value={filters.min_duration || ''}
              onChange={update('min_duration')}
              onBlur={normalizeDurations}
              placeholder="e.g. 10"
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-max">Max Duration (sec)</label>
            <input
              id="f-max"
              className="input"
              type="number"
              min="0"
              step="1"
              value={filters.max_duration || ''}
              onChange={update('max_duration')}
              onBlur={normalizeDurations}
              placeholder="e.g. 120"
            />
          </div>

          <div className="form-group">
            <label htmlFor="f-start">Start Date</label>
            <input
              id="f-start"
              className="input"
              type="datetime-local"
              value={formatDatetimeLocal(filters.start_date)}
              onChange={handleDateTimeChange('start_date')}
              onBlur={normalizeDates}
            />
            {filters.start_date && (
              <small className="field-hint">
                UTC: {new Date(filters.start_date).toISOString().replace('T', ' ').slice(0, 19)}
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="f-end">End Date</label>
            <input
              id="f-end"
              className="input"
              type="datetime-local"
              value={formatDatetimeLocal(filters.end_date)}
              onChange={handleDateTimeChange('end_date')}
              onBlur={normalizeDates}
            />
            {filters.end_date && (
              <small className="field-hint">
                UTC: {new Date(filters.end_date).toISOString().replace('T', ' ').slice(0, 19)}
              </small>
            )}
          </div>

          <div className="filters-actions">
            <button 
              className="btn btn-secondary" 
              onClick={clear}
              disabled={activeFilterCount === 0}
            >
              Clear All {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default Filters;