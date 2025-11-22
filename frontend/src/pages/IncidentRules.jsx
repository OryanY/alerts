import React, { useEffect, useState } from 'react';
import { API_BASE } from '../utils/constants';
import {
  Target, Plus, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Eye,
  AlertTriangle, X, ToggleLeft, ToggleRight, Filter, ArrowDown, Trash
} from 'lucide-react';

const CONDITION_OPERATORS = {
  contains: { label: 'Contains', icon: '🔍' },
  equals: { label: 'Equals', icon: '=' },
  regex: { label: 'Regex Pattern', icon: '🎯' }
};

const CONDITION_FIELDS = {
  message: { label: 'Alert Message', icon: '💬', placeholder: 'CPU usage high' },
  node_name: { label: 'Node Name', icon: '🖥️', placeholder: 'prod-worker-01' },
  object_name: { label: 'Object Name', icon: '🎯', placeholder: 'elasticsearch' },
  network: { label: 'Network', icon: '🌐', placeholder: 'prod-network' },
  operator: { label: 'Operator', icon: '👤', placeholder: 'john.doe' }
};

const IncidentRules = () => {
  const [rules, setRules] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const [form, setForm] = useState({
    system_mapping_id: '',
    rule_name: '',
    description: '',
    conditions: [],
    logic_operator: 'OR',
    incident_overrides: {
      short_description: '',
      description: '',
      u_system_failure: false
    },
    enabled: true
  });

  const selectedMapping = React.useMemo(() => {
  try {
    // If editing, use the system_mapping that came with the rule
    if (editingItem?.system_mapping) {
      return editingItem.system_mapping;
    }
    // If creating new, find the mapping by ID
    return mappings.find(m => String(m._id) === String(form.system_mapping_id)); 
  } catch { 
    return undefined; 
  }
}, [mappings, form.system_mapping_id, editingItem]);

const customFieldsInMapping = React.useMemo(() => {
  if (!selectedMapping) return [];
  
  const excludeKeys = ['_id', 'grafana_names', 'service_offering', 'business_service', 
                       'u_network', 'u_impact_technology', 'assignment_group', 
                       'u_system_failure', 'created_at', 'updated_at'];
  
  return Object.keys(selectedMapping).filter(k => !excludeKeys.includes(k));
}, [selectedMapping]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/incidents/incident-rules`);
      const data = await res.json();
      if (data.success) setRules(data.data || []);
      else setError('Failed to fetch incident rules');
    } catch (e) {
      setError('Error connecting to server: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMappings = async () => {
    try {
      const res = await fetch(`${API_BASE}/incidents/system-mappings`);
      const data = await res.json();
      if (data.success) setMappings(data.data || []);
    } catch (e) {
      console.warn('Failed to fetch mappings:', e);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchRules();
  }, []);

  const reset = () => {
    setForm({
      system_mapping_id: '',
      rule_name: '',
      description: '',
      conditions: [],
      logic_operator: 'OR',
      incident_overrides: {
        short_description: '',
        description: '',
        u_system_failure: false
      },
      enabled: true
    });
    setEditingItem(null);
    setPreviewMode(false);
  };

  const addCondition = () => {
    setForm(prev => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        {
          id: Date.now(),
          field: 'message',
          operator: 'contains',
          value: ''
        }
      ]
    }));
  };

  const removeCondition = (id) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== id)
    }));
  };

  const updateCondition = (id, updates) => {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.map(c =>
        c.id === id ? { ...c, ...updates } : c
      )
    }));
  };

  const save = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (form.conditions.length === 0) {
      setError('Please add at least one condition');
      return;
    }

    try {
      const legacyConditions = {};

      form.conditions.forEach(condition => {
        const { field, operator, value } = condition;
        if (!value || !String(value).trim()) return;

        const cleanValue = String(value).trim();

        if (operator === 'contains') {
          const key = `${field}_contains`;
          if (!legacyConditions[key]) legacyConditions[key] = [];
          legacyConditions[key].push(cleanValue);
        } else if (operator === 'equals') {
          legacyConditions[`${field}_exact`] = cleanValue;
        } else if (operator === 'regex') {
          legacyConditions[`${field}_regex`] = cleanValue;
        }
      });

      const cleanOverrides = {};
      Object.entries(form.incident_overrides).forEach(([key, value]) => {
        if (key === 'u_system_failure') {
          cleanOverrides[key] = Boolean(value);
        } else if (value && String(value).trim() !== '') {
          cleanOverrides[key] = String(value).trim();
        }
      });

      const payload = {
        system_mapping_id: form.system_mapping_id,
        rule_name: form.rule_name,
        description: form.description || undefined,
        conditions: legacyConditions,
        logic_operator: form.logic_operator,
        incident_overrides:
          Object.keys(cleanOverrides).length > 0 ? cleanOverrides : undefined,
        enabled: form.enabled
      };

      const url = editingItem
        ? `${API_BASE}/incidents/incident-rules/${editingItem._id}`
        : `${API_BASE}/incidents/incident-rules`;
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        await fetchRules();
        reset();
        setShowForm(false);
        setError(null);
      } else {
        setError(data.details || 'Failed to save rule');
      }
    } catch (e) {
      setError('Error saving rule: ' + e.message);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`${API_BASE}/incidents/incident-rules/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        await fetchRules();
        setError(null);
      } else {
        setError(data.details || 'Failed to delete rule');
      }
    } catch (e) {
      setError('Error deleting rule: ' + e.message);
    }
  };

  const toggle = async (id, enabled) => {
    try {
      const res = await fetch(
        `${API_BASE}/incidents/incident-rules/${id}/toggle`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled })
        }
      );
      const data = await res.json();
      if (data.success) {
        await fetchRules();
        setError(null);
      } else {
        setError(data.details || 'Failed to toggle rule');
      }
    } catch (e) {
      setError('Error toggling rule: ' + e.message);
    }
  };

const startEdit = (rule) => {
  const newConditions = [];
  let conditionId = 1;
  const addedConditions = new Set();

  Object.keys(CONDITION_FIELDS).forEach(field => {
    if (rule.conditions?.[`${field}_contains`]?.length) {
      rule.conditions[`${field}_contains`].forEach(value => {
        const key = `${field}-contains-${value}`;
        if (!addedConditions.has(key)) {
          newConditions.push({ id: conditionId++, field, operator: 'contains', value });
          addedConditions.add(key);
        }
      });
    }
    
    if (rule.conditions?.[`${field}_exact`]) {
      const key = `${field}-equals-${rule.conditions[`${field}_exact`]}`;
      if (!addedConditions.has(key)) {
        newConditions.push({ id: conditionId++, field, operator: 'equals', value: rule.conditions[`${field}_exact`] });
        addedConditions.add(key);
      }
    }
    
    if (rule.conditions?.[`${field}_regex`]) {
      const key = `${field}-regex-${rule.conditions[`${field}_regex`]}`;
      if (!addedConditions.has(key)) {
        newConditions.push({ id: conditionId++, field, operator: 'regex', value: rule.conditions[`${field}_regex`] });
        addedConditions.add(key);
      }
    }
  });

  if (rule.conditions?.network) {
    const key = `network-contains-${rule.conditions.network}`;
    if (!addedConditions.has(key)) {
      newConditions.push({ id: conditionId++, field: 'network', operator: 'contains', value: rule.conditions.network });
      addedConditions.add(key);
    }
  }

  setForm({
    system_mapping_id: rule.system_mapping_id || rule.system_mapping?._id || '',
    rule_name: rule.rule_name || '',
    description: rule.description || '',
    conditions: newConditions,
    logic_operator: rule.logic_operator || 'OR',
    incident_overrides: rule.incident_overrides || {
      short_description: '',
      description: '',
      u_system_failure: false
    },
    enabled: rule.enabled !== false
  });
  
  setEditingItem(rule); // Store the full rule object including system_mapping
  setShowForm(true);

  setTimeout(() => {
    document.getElementById('rule-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
};

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        borderRadius: 12,
        border: '2px solid #cbd5e1'
      }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw
            size={32}
            style={{
              animation: 'spin 1s linear infinite',
              color: '#a855f7',
              marginBottom: 16
            }}
          />
          <div style={{
            fontSize: 18,
            color: '#475569',
            fontWeight: 500
          }}>
            Loading rules...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      {error && (
        <div style={{
          background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          border: '2px solid #f87171',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertTriangle size={20} color="#dc2626" />
          <div>
            <div style={{
              fontWeight: 600,
              color: '#dc2626',
              marginBottom: 4
            }}>
              Error
            </div>
            <div style={{
              color: '#b91c1c',
              fontSize: 14
            }}>
              {String(error)}
            </div>
          </div>

          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#dc2626',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
        padding: '0 8px'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 700,
          color: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <Target size={28} color="#1e293b" />
          Incident Rules
        </h2>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              reset();
              setShowForm(!showForm);
            }}
            style={{
              background: showForm
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cancel' : 'Create Rule'}
          </button>

          <button
            onClick={fetchRules}
            style={{
              background: 'white',
              color: '#475569',
              border: '2px solid #e2e8f0',
              borderRadius: 12,
              padding: '12px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* FORM */}
      {showForm && (
        <div
          id="rule-form"
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            marginBottom: 32,
            border: '1px solid #f1f5f9',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)'
          }} />

          <div style={{ marginTop: 8 }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24
            }}>
              <div>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  {editingItem ? <Edit size={24} /> : <Plus size={24} />}
                  {editingItem ? 'Update Rule' : 'Create Rule'}
                </h3>

                <p style={{
                  margin: 0,
                  color: '#64748b',
                  fontSize: 16
                }}>
                  Set up conditions for when this rule should trigger
                </p>
              </div>

              <button
                type="button"
                style={{
                  background: previewMode ? '#22c55e' : 'white',
                  color: previewMode ? 'white' : '#64748b',
                  border: '2px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye size={14} />
                {previewMode ? 'Hide Preview' : 'Show Preview'}
              </button>
            </div>
            <form
              onSubmit={save}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 32
              }}
            >
              {/* BASIC INFO */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  padding: 24,
                  borderRadius: 12,
                  border: '2px solid #e2e8f0'
                }}
              >
                <h4
                  style={{
                    margin: '0 0 20px 0',
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#1e293b'
                  }}
                >
                  Rule Setup
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 20
                  }}
                >
                  {/* SYSTEM MAPPING */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: 8
                      }}
                    >
                      Base System Mapping *
                    </label>
                    <select
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'white'
                      }}
                      required
                      value={form.system_mapping_id}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          system_mapping_id: e.target.value
                        }))
                      }
                    >
                      <option value="">Choose a system mapping...</option>

                      {mappings.map((m) => (
                        <option key={String(m._id)} value={m._id}>
                          [{(m.grafana_names || []).join(', ')}] →{' '}
                          {String(m.service_offering)}
                        </option>
                      ))}
                    </select>

                    {selectedMapping && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: '#64748b'
                        }}
                      >
                        Applies to:{' '}
                        <strong>
                          {(selectedMapping.grafana_names || []).join(', ')}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* RULE NAME */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: 8
                      }}
                    >
                      Rule Name *
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'white'
                      }}
                      required
                      value={form.rule_name}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          rule_name: e.target.value
                        }))
                      }
                      placeholder="e.g., ECK High CPU Alerts"
                    />
                  </div>

                  {/* DESCRIPTION */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: 8
                      }}
                    >
                      Description
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #d1d5db',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'white'
                      }}
                      value={String(form.description || '')}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          description: e.target.value
                        }))
                      }
                      placeholder="Describe when this rule triggers…"
                    />
                  </div>
                </div>
              </div>

              {/* CONDITION BUILDER */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  padding: 24,
                  borderRadius: 12,
                  border: '2px solid #3b82f6'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      color: '#1e40af'
                    }}
                  >
                    WHEN Alert Matches…
                  </h4>

                  {/* LOGIC BUTTONS + ADD CONDITION */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        background: 'white',
                        borderRadius: 8,
                        border: '2px solid #93c5fd',
                        overflow: 'hidden'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({ ...p, logic_operator: 'OR' }))
                        }
                        style={{
                          background:
                            form.logic_operator === 'OR'
                              ? '#3b82f6'
                              : 'white',
                          color:
                            form.logic_operator === 'OR'
                              ? 'white'
                              : '#3b82f6',
                          border: 'none',
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        OR
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setForm((p) => ({ ...p, logic_operator: 'AND' }))
                        }
                        style={{
                          background:
                            form.logic_operator === 'AND'
                              ? '#3b82f6'
                              : 'white',
                          color:
                            form.logic_operator === 'AND'
                              ? 'white'
                              : '#3b82f6',
                          border: 'none',
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        AND
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={addCondition}
                      style={{
                        background:
                          'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Plus size={16} />
                      Add Condition
                    </button>
                  </div>
                </div>

                {/* NO CONDITIONS */}
                {form.conditions.length === 0 && (
                  <div
                    style={{
                      background: 'white',
                      padding: 32,
                      borderRadius: 8,
                      textAlign: 'center',
                      border: '2px dashed #93c5fd'
                    }}
                  >
                    <Filter size={48} color="#93c5fd" style={{ marginBottom: 16 }} />
                    <button
                      type="button"
                      onClick={addCondition}
                      style={{
                        background:
                          'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px 24px',
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Add Your First Condition
                    </button>
                  </div>
                )}

                {/* CONDITIONS LIST */}
                {form.conditions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {form.conditions.map((condition, index) => (
                      <div key={String(condition.id)}>
                        <div
                          style={{
                            background: 'white',
                            padding: 20,
                            borderRadius: 8,
                            border: '2px solid #bfdbfe',
                            position: 'relative'
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: -1,
                              left: 16,
                              background: '#3b82f6',
                              color: 'white',
                              padding: '4px 12px',
                              borderRadius: '0 0 8px 8px',
                              fontSize: 12,
                              fontWeight: 600
                            }}
                          >
                            Condition {index + 1}
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 2fr auto',
                              gap: 16,
                              alignItems: 'end',
                              marginTop: 12
                            }}
                          >
                            {/* FIELD */}
                            <select
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #bfdbfe',
                                borderRadius: 6,
                                fontSize: 14,
                                background: '#f8fafc'
                              }}
                              value={condition.field}
                              onChange={(e) =>
                                updateCondition(condition.id, {
                                  field: e.target.value
                                })
                              }
                            >
                              {Object.entries(CONDITION_FIELDS).map(
                                ([key, field]) => (
                                  <option key={String(key)} value={key}>
                                    {field.label}
                                  </option>
                                )
                              )}
                            </select>

                            {/* OPERATOR */}
                            <select
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #bfdbfe',
                                borderRadius: 6,
                                fontSize: 14,
                                background: '#f8fafc'
                              }}
                              value={condition.operator}
                              onChange={(e) =>
                                updateCondition(condition.id, {
                                  operator: e.target.value
                                })
                              }
                            >
                              {Object.entries(CONDITION_OPERATORS).map(
                                ([key, op]) => (
                                  <option key={String(key)} value={key}>
                                    {op.label}
                                  </option>
                                )
                              )}
                            </select>

                            {/* VALUE */}
                            <input
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #bfdbfe',
                                borderRadius: 6,
                                fontSize: 14,
                                background: 'white'
                              }}
                              value={String(condition.value || '')}
                              onChange={(e) =>
                                updateCondition(condition.id, {
                                  value: e.target.value
                                })
                              }
                              placeholder={
                                CONDITION_FIELDS[condition.field]?.placeholder ||
                                'Enter value...'
                              }
                            />

                            <button
                              type="button"
                              onClick={() => removeCondition(condition.id)}
                              style={{
                                background:
                                  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: 6,
                                padding: '8px',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </div>

                        {index < form.conditions.length - 1 && (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '8px 0'
                            }}
                          >
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                background:
                                  form.logic_operator === 'OR'
                                    ? '#fef3c7'
                                    : '#dbeafe',
                                color:
                                  form.logic_operator === 'OR'
                                    ? '#f59e0b'
                                    : '#3b82f6',
                                padding: '4px 12px',
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 700
                              }}
                            >
                              <ArrowDown size={14} />
                              {form.logic_operator}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Incident Overrides - Using system_mapping data */}
              <div style={{background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: 24, borderRadius: 12, border: '2px solid #22c55e'}}>
                <h4 style={{margin: '0 0 20px 0', fontSize: 18, fontWeight: 600, color: '#166534'}}>
                  THEN Override Incident Fields...
                </h4>

                <div style={{background: 'white', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #86efac'}}>
                  <p style={{margin: 0, fontSize: 14, color: '#166534', fontWeight: 500}}>
                    💡 Template Variables: <code style={{background: '#dcfce7', padding: '2px 6px', borderRadius: 4}}>{'{{ application }}'}</code>, 
                    <code style={{background: '#dcfce7', padding: '2px 6px', borderRadius: 4, marginLeft: 4}}>{'{{ object_name }}'}</code>, 
                    <code style={{background: '#dcfce7', padding: '2px 6px', borderRadius: 4, marginLeft: 4}}>{'{{ node_name }}'}</code>, 
                    <code style={{background: '#dcfce7', padding: '2px 6px', borderRadius: 4, marginLeft: 4}}>{'{{ message }}'}</code>, 
                    <code style={{background: '#dcfce7', padding: '2px 6px', borderRadius: 4, marginLeft: 4}}>{'{{ operator }}'}</code>, 
                    <code style={{background: '#dcfce7', padding: '2px 6px', borderRadius: 4, marginLeft: 4}}>{'{{ network }}'}</code>
                  </p>
                </div>

                {!selectedMapping && (
                  <div style={{background: '#fffbeb', padding: 16, borderRadius: 8, border: '2px solid #fbbf24', marginBottom: 20}}>
                    <p style={{margin: 0, fontSize: 14, color: '#92400e'}}>
                      ⚠️ Select a system mapping first to see available fields and their base values
                    </p>
                  </div>
                )}

                {/* Standard Override Fields */}
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16}}>
                  <div>
                    <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8}}>
                      Short Description
                    </label>
                    <input
                      style={{width: '100%', padding: '12px 16px', border: '2px solid #bbf7d0', borderRadius: 8, fontSize: 14, background: 'white'}}
                      value={form.incident_overrides.short_description || ''}
                      onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, short_description: e.target.value}}))}
                      placeholder="Alert: {{object_name}} on {{node_name}}"
                    />
                    {selectedMapping && (
                      <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                        📋 Base: <strong>{selectedMapping.short_description || 'קפצה התראה על: {{object_name}} - {{application}}'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8}}>
                      Assignment Group
                    </label>
                    <input
                      style={{width: '100%', padding: '12px 16px', border: '2px solid #bbf7d0', borderRadius: 8, fontSize: 14, background: 'white'}}
                      value={form.incident_overrides.assignment_group || ''}
                      onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, assignment_group: e.target.value}}))}
                      placeholder="Override assignment group"
                    />
                    {selectedMapping && (
                      <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                        📋 Base: <strong>{selectedMapping.assignment_group || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8}}>
                      Service Offering
                    </label>
                    <input
                      style={{width: '100%', padding: '12px 16px', border: '2px solid #bbf7d0', borderRadius: 8, fontSize: 14, background: 'white'}}
                      value={form.incident_overrides.service_offering || ''}
                      onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, service_offering: e.target.value}}))}
                      placeholder="Override service offering"
                    />
                    {selectedMapping && (
                      <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                        📋 Base: <strong>{selectedMapping.service_offering || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8}}>
                      Business Service
                    </label>
                    <input
                      style={{width: '100%', padding: '12px 16px', border: '2px solid #bbf7d0', borderRadius: 8, fontSize: 14, background: 'white'}}
                      value={form.incident_overrides.business_service || ''}
                      onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, business_service: e.target.value}}))}
                      placeholder="Override business service"
                    />
                    {selectedMapping && (
                      <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                        📋 Base: <strong>{selectedMapping.business_service || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8}}>
                      Network
                    </label>
                    <input
                      style={{width: '100%', padding: '12px 16px', border: '2px solid #bbf7d0', borderRadius: 8, fontSize: 14, background: 'white'}}
                      value={form.incident_overrides.u_network || ''}
                      onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, u_network: e.target.value}}))}
                      placeholder="Override network (e.g., PROD, QA)"
                    />
                    {selectedMapping && (
                      <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                        📋 Base: <strong>{selectedMapping.u_network || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8}}>
                      Impact Technology
                    </label>
                    <input
                      style={{width: '100%', padding: '12px 16px', border: '2px solid #bbf7d0', borderRadius: 8, fontSize: 14, background: 'white'}}
                      value={form.incident_overrides.u_impact_technology || ''}
                      onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, u_impact_technology: e.target.value}}))}
                      placeholder="Override impact technology"
                    />
                    {selectedMapping && (
                      <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                        📋 Base: <strong>{selectedMapping.u_impact_technology || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, fontWeight: 600, color: '#166534', cursor: 'pointer'}}>
                      <input
                        type="checkbox"
                        checked={form.incident_overrides.u_system_failure || false}
                        onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, u_system_failure: e.target.checked}}))}
                        style={{width: 18, height: 18, accentColor: '#22c55e'}}
                      />
                      System Failure
                    </label>
                    <p style={{margin: '4px 0 0 30px', fontSize: 12, color: '#15803d'}}>
                      Creates outage automatically
                    </p>
                    {selectedMapping && (
                      <p style={{margin: '4px 0 0 30px', fontSize: 12, color: '#15803d'}}>
                        📋 Base: <strong>{selectedMapping.u_system_failure ? 'YES' : 'NO'}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Full Description - Full Width */}
                <div style={{marginBottom: 20}}>
                  <label style={{display: 'block', fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 8}}>
                    Description (Full)
                  </label>
                  <textarea
                    style={{
                      width: '100%', 
                      padding: '12px 16px', 
                      border: '2px solid #bbf7d0', 
                      borderRadius: 8, 
                      fontSize: 14, 
                      background: 'white', 
                      minHeight: 120, 
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                    value={form.incident_overrides.description || ''}
                    onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, description: e.target.value}}))}
                    placeholder="Full incident description with template variables...&#10;Example:&#10;Alert: {{object_name}} on {{node_name}}&#10;Message: {{message}}&#10;Operator: {{operator}}"
                  />
                  {selectedMapping && (
                    <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                      📋 Base: <strong>{selectedMapping.description || 'ההתראה: Message: {{message}}'}</strong>
                    </p>
                  )}
                </div>

                {/* Custom fields for selected mapping */}
                {customFieldsInMapping.length > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                    padding: 20,
                    borderRadius: 8,
                    border: '2px solid #e9d5ff'
                  }}>
                    <h5 style={{margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: '#9333ea', display: 'flex', alignItems: 'center', gap: 8}}>
                      ⚙️ Custom Fields ({customFieldsInMapping.length})
                    </h5>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16}}>
                      {customFieldsInMapping.map(fieldName => (
                        <div key={fieldName}>
                          <label style={{ fontSize: 14, fontWeight: 600, color: '#9333ea', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6}}>
                            <span style={{fontFamily: 'monospace'}}>{fieldName}</span>
                          </label>
                          <input
                            style={{width: '100%', padding: '12px 16px', border: '2px solid #e9d5ff', borderRadius: 8, fontSize: 14, background: 'white'}}
                            value={form.incident_overrides[fieldName] || ''}
                            onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, [fieldName]: e.target.value}}))}
                            placeholder={`Override ${fieldName} (optional)`}
                          />
                          <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#7c3aed'}}>
                            📋 Base value: <strong style={{fontFamily: 'monospace'}}>{selectedMapping?.[fieldName] || '—'}</strong>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* ACTION BUTTONS */}
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  justifyContent: 'flex-end',
                  paddingTop: 24,
                  borderTop: '2px solid #f1f5f9'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setShowForm(false);
                  }}
                  style={{
                    background: 'white',
                    color: '#64748b',
                    border: '2px solid #e2e8f0',
                    borderRadius: 8,
                    padding: '12px 24px',
                    fontSize: 16,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    background:
                      'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 32px',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: form.conditions.length === 0 ? 0.5 : 1
                  }}
                  disabled={form.conditions.length === 0}
                >
                  {editingItem ? '✓ Update Rule' : '🚀 Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RULES LIST */}
      {rules.length === 0 ? (
        <div
          style={{
            background: 'linear-gradient(135deg, #fef7ff 0%, #fae8ff 100%)',
            border: '3px dashed #d8b4fe',
            borderRadius: 16,
            padding: 48,
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h3
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#7c3aed',
              marginBottom: 12
            }}
          >
            No Rules Yet
          </h3>
          <p
            style={{
              fontSize: 16,
              color: '#a855f7',
              marginBottom: 24
            }}
          >
            Create rules to handle specific alert types with custom conditions.
          </p>
        </div>
      ) : (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
              padding: '0 8px'
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: '#1e293b'
              }}
            >
              Your Rules ({rules.length})
            </h3>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}
          >
            {rules.map((rule) => {
              const ruleMapping = rule.system_mapping;

              const customFieldsInRule = ruleMapping
                ? Object.keys(ruleMapping).filter(
                    (k) =>
                      ![
                        '_id',
                        'grafana_names',
                        'service_offering',
                        'business_service',
                        'u_network',
                        'u_impact_technology',
                        'assignment_group',
                        'u_system_failure',
                        'created_at',
                        'updated_at'
                      ].includes(k)
                  )
                : [];

              return (
                <div
                  key={String(rule._id)}
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #f1f5f9',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: rule.enabled
                        ? 'linear-gradient(90deg, #22c55e, #10b981)'
                        : 'linear-gradient(90deg, #64748b, #475569)'
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 20,
                      marginTop: 8
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 8,
                          flexWrap: 'wrap'
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 700,
                            color: '#1e293b'
                          }}
                        >
                          {String(rule.rule_name)}
                        </h4>

                        {/* STATUS BADGE */}
                        <div
                          style={{
                            background: rule.enabled
                              ? '#dcfce7'
                              : '#f1f5f9',
                            color: rule.enabled
                              ? '#166534'
                              : '#64748b',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          {rule.enabled ? (
                            <CheckCircle size={12} />
                          ) : (
                            <XCircle size={12} />
                          )}
                          {rule.enabled ? 'ACTIVE' : 'INACTIVE'}
                        </div>

                        {/* LOGIC BADGE */}
                        <div
                          style={{
                            background: '#e0f2fe',
                            color: '#0c4a6e',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600
                          }}
                        >
                          {String(rule.logic_operator || 'OR')} Logic
                        </div>

                        {/* CUSTOM FIELDS COUNT */}
                        {customFieldsInRule.length > 0 && (
                          <div
                            style={{
                              background: '#faf5ff',
                              color: '#9333ea',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600
                            }}
                          >
                            {customFieldsInRule.length} Custom Field
                            {customFieldsInRule.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      {/* APPLICATIONS */}
                      <p style={{margin: '0 0 8px 0', fontSize: 14, color: '#64748b'}}>
                        <strong>Applications: </strong>
                        {(rule.grafana_names || []).map((pattern, idx) => {
                          const patternValue = typeof pattern === 'string' ? pattern : pattern.value;
                          const patternType = typeof pattern === 'string' ? 'exact' : pattern.type;
                          const patternIcon = patternType === 'exact' ? '🎯' : patternType === 'regex' ? '⚡' : '🔍';
                          
                          return (
                            <span 
                              key={`${patternValue}-${idx}`}
                              style={{
                                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 600,
                                marginRight: 4,
                                display: 'inline-block'
                              }}
                            >
                              {patternIcon} {patternValue}
                            </span>
                          );
                        })}
                      </p>

                      {/* DESCRIPTION */}
                      {rule.description && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: '#64748b',
                            fontStyle: 'italic'
                          }}
                        >
                          {String(rule.description)}
                        </p>
                      )}
                    </div>

                    {/* ACTION BUTTONS */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap'
                      }}
                    >
                      {/* ENABLE / DISABLE */}
                      <button
                        onClick={() =>
                          toggle(rule._id, !Boolean(rule.enabled))
                        }
                        style={{
                          background: rule.enabled
                            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                            : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {rule.enabled ? (
                          <ToggleRight size={14} />
                        ) : (
                          <ToggleLeft size={14} />
                        )}
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>

                      {/* EDIT */}
                      <button
                        onClick={() => startEdit(rule)}
                        style={{
                          background:
                            'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Edit size={12} />
                        Edit
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => del(rule._id)}
                        style={{
                          background:
                            'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* CONDITIONS DISPLAY */}
                  <div
                    style={{
                      background:
                        'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                      padding: 16,
                      borderRadius: 8,
                      marginBottom: 16,
                      border: '2px solid #3b82f6'
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#1e40af',
                        marginBottom: 12
                      }}
                    >
                      Conditions ({String(rule.logic_operator || 'OR')} Logic)
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      {Object.entries(rule.conditions || {}).map(
                        ([key, value]) => {
                          if (Array.isArray(value)) {
                            return value.map((v, idx) => (
                              <div
                                key={`${String(key)}-${idx}`}
                                style={{
                                  background: 'white',
                                  padding: 8,
                                  borderRadius: 4,
                                  border: '1px solid #93c5fd',
                                  fontSize: 12
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: '#1e40af'
                                  }}
                                >
                                  {String(key).replace(/_/g, ' ')}:
                                </span>
                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontFamily: 'monospace',
                                    color: '#3730a3'
                                  }}
                                >
                                  "{String(v)}"
                                </span>
                              </div>
                            ));
                          }

                          if (value && typeof value === 'string') {
                            return (
                              <div
                                key={String(key)}
                                style={{
                                  background: 'white',
                                  padding: 8,
                                  borderRadius: 4,
                                  border: '1px solid #93c5fd',
                                  fontSize: 12
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: '#1e40af'
                                  }}
                                >
                                  {String(key).replace(/_/g, ' ')}:
                                </span>

                                <span
                                  style={{
                                    marginLeft: 8,
                                    fontFamily: 'monospace',
                                    color: '#3730a3'
                                  }}
                                >
                                  {String(key).includes('regex')
                                    ? `/${String(value)}/`
                                    : `"${String(value)}"`}
                                </span>
                              </div>
                            );
                          }

                          return null;
                        }
                      )}
                    </div>
                  </div>

                  {/* OVERRIDES DISPLAY */}
                  {rule.incident_overrides &&
                    Object.keys(rule.incident_overrides).length > 0 && (
                      <div
                        style={{
                          background:
                            'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                          padding: 16,
                          borderRadius: 8,
                          marginBottom: 16,
                          border: '2px solid #22c55e'
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#166534',
                            marginBottom: 12
                          }}
                        >
                          Incident Overrides
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: 8
                          }}
                        >
                          {Object.entries(
                            rule.incident_overrides
                          )
                            .filter(([k]) => k !== 'description')
                            .map(([k, v]) => (
                              <div
                                key={String(k)}
                                style={{
                                  background:
                                    k === 'u_system_failure'
                                      ? '#fef2f2'
                                      : customFieldsInRule.includes(k)
                                      ? '#faf5ff'
                                      : 'white',
                                  padding: 8,
                                  borderRadius: 4,
                                  border:
                                    k === 'u_system_failure'
                                      ? '1px solid #fecaca'
                                      : customFieldsInRule.includes(k)
                                      ? '1px solid #e9d5ff'
                                      : '1px solid #86efac',
                                  fontSize: 12
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color:
                                      k === 'u_system_failure'
                                        ? '#dc2626'
                                        : customFieldsInRule.includes(k)
                                        ? '#9333ea'
                                        : '#166534'
                                  }}
                                >
                                  {String(k).replace(/_/g, ' ')}:
                                </span>

                                <div
                                  style={{
                                    marginTop: 4,
                                    color:
                                      k === 'u_system_failure'
                                        ? '#dc2626'
                                        : customFieldsInRule.includes(k)
                                        ? '#6b21a8'
                                        : '#15803d',
                                    fontWeight:
                                      k === 'u_system_failure'
                                        ? 600
                                        : 'normal'
                                  }}
                                >
                                  {k === 'u_system_failure'
                                    ? v
                                      ? 'YES'
                                      : 'NO'
                                    : String(v)}
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* DESCRIPTION TEMPLATE */}
                        {rule.incident_overrides.description && (
                          <div style={{ marginTop: 12 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#166534',
                                marginBottom: 4
                              }}
                            >
                              Description template:
                            </div>

                            <div
                              style={{
                                background: 'white',
                                border: '1px solid #86efac',
                                borderRadius: 4,
                                padding: 10,
                                whiteSpace: 'pre-wrap',
                                maxHeight: 120,
                                overflow: 'auto',
                                fontSize: 11,
                                color: '#15803d'
                              }}
                            >
                              {String(rule.incident_overrides.description)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {/* META INFO */}
                  {rule.created_at && (
                    <div
                      style={{
                        paddingTop: 16,
                        borderTop: '1px solid #f1f5f9',
                        fontSize: 12,
                        color: '#94a3b8'
                      }}
                    >
                      Created:{' '}
                      {new Date(rule.created_at).toLocaleString()}

                      {rule.updated_at &&
                        rule.updated_at !== rule.created_at && (
                          <span>
                            {' '}
                            • Updated:{' '}
                            {new Date(
                              rule.updated_at
                            ).toLocaleString()}
                          </span>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentRules;
