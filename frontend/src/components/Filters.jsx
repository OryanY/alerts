import { useState } from 'react';
import './Filters.css';

const Filters = ({ filters, setFilters }) => {
  const [open, setOpen] = useState(false);

  const update = (field) => (e) =>
    setFilters((prev) => ({ ...prev, [field]: e.target.value }));

  const clear = () => {
    setFilters({
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
  };

  return (
    <div className="filters card">
      <div className="filters-header">
        <h3 className="filters-title"> Filters</h3>
        <button
          className="btn btn-primary"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filters-content"
        >
          {open ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {open && (
        <div id="filters-content" className="filters-grid">
          <div className="form-group">
            <label>Panel Title</label>
            <input className="input" value={filters.panel_title} onChange={update('panel_title')} placeholder="Search panel..." />
          </div>

          <div className="form-group">
            <label>Application</label>
            <input className="input" value={filters.application} onChange={update('application')} placeholder="Search application..." />
          </div>

          <div className="form-group">
            <label>Node Name</label>
            <input className="input" value={filters.node_name} onChange={update('node_name')} placeholder="Search node..." />
          </div>

          <div className="form-group">
            <label>Network</label>
            <input className="input" value={filters.network} onChange={update('network')} placeholder="Search network..." />
          </div>

          <div className="form-group">
            <label>Operator</label>
            <input className="input" value={filters.operator} onChange={update('operator')} placeholder="Search operator..." />
          </div>

          <div className="form-group">
            <label>Min Duration (sec)</label>
            <input className="input" type="number" value={filters.min_duration} onChange={update('min_duration')} placeholder="0" />
          </div>

          <div className="form-group">
            <label>Max Duration (sec)</label>
            <input className="input" type="number" value={filters.max_duration} onChange={update('max_duration')} placeholder="300" />
          </div>

          <div className="form-group">
            <label>Start Date</label>
            <input className="input" type="datetime-local" value={filters.start_date} onChange={update('start_date')} />
          </div>

          <div className="form-group">
            <label>End Date</label>
            <input className="input" type="datetime-local" value={filters.end_date} onChange={update('end_date')} />
          </div>

          <div className="filters-actions">
            <button className="btn btn-secondary" onClick={clear}>Clear All</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Filters;