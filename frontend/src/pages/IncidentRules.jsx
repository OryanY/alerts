// frontend/src/pages/IncidentRules.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { API_BASE } from '../utils/constants';

import {
  Target,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  X,
  ToggleLeft,
  ToggleRight,
  Filter,
  ArrowDown,
  Trash,
} from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';

const CONDITION_OPERATORS = {
  contains: { label: 'Contains', icon: '🔍' },
  equals: { label: 'Equals', icon: '=' },
  regex: { label: 'Regex Pattern', icon: '🎯' },
};

const CONDITION_FIELDS = {
  message: { label: 'Alert Message', icon: '💬', placeholder: 'CPU usage high' },
  node_name: { label: 'Node Name', icon: '🖥️', placeholder: 'db-prod-01' },
  object_name: { label: 'Object Name', icon: '🎯', placeholder: 'eck' },
  network: { label: 'Network', icon: '🌐', placeholder: 'nh' },
  operator: { label: 'Operator', icon: '👤', placeholder: 'matok' },
};

const EXCLUDED_MAPPING_FIELDS = [
  '_id',
  'grafana_names',
  'service_offering',
  'business_service',
  'u_network',
  'u_impact_technology',
  'assignment_group',
  'u_system_failure',
  'created_at',
  'updated_at',
];

const IncidentRules = () => {
  const { colors, gradients, PATTERN_COLORS } = useTheme();

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
      u_system_failure: false,
    },
    enabled: true,
  });

  /* ----------------------------------------------------------------
   * MAPPING HELPERS
   * ---------------------------------------------------------------- */
  const selectedMapping = useMemo(() => {
    try {
      if (editingItem?.system_mapping) {
        return editingItem.system_mapping;
      }
      return mappings.find((m) => String(m._id) === String(form.system_mapping_id));
    } catch {
      return undefined;
    }
  }, [mappings, form.system_mapping_id, editingItem]);

  const customFieldsInMapping = useMemo(() => {
    if (!selectedMapping) return [];
    return Object.keys(selectedMapping).filter((k) => !EXCLUDED_MAPPING_FIELDS.includes(k));
  }, [selectedMapping]);

  /* ----------------------------------------------------------------
   * API CALLS
   * ---------------------------------------------------------------- */
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

  /* ----------------------------------------------------------------
   * FORM HELPERS
   * ---------------------------------------------------------------- */
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
        u_system_failure: false,
      },
      enabled: true,
    });
    setEditingItem(null);
    setPreviewMode(false);
  };

  const addCondition = () => {
    setForm((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        {
          id: Date.now(),
          field: 'message',
          operator: 'contains',
          value: '',
        },
      ],
    }));
  };

  const removeCondition = (id) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((c) => c.id !== id),
    }));
  };

  const updateCondition = (id, updates) => {
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  /* ----------------------------------------------------------------
   * SAVE / DELETE / TOGGLE
   * ---------------------------------------------------------------- */
  const save = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (form.conditions.length === 0) {
      setError('Please add at least one condition');
      return;
    }

    try {
      const legacyConditions = {};

      form.conditions.forEach((condition) => {
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
        enabled: form.enabled,
      };

      const url = editingItem
        ? `${API_BASE}/incidents/incident-rules/${editingItem._id}`
        : `${API_BASE}/incidents/incident-rules`;
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        await fetchRules();
        reset();
        setShowForm(false);
        setError(null);
      } else {
        setError(data.error.message || 'Failed to save rule');
      }
    } catch (e) {
      setError('Error saving rule: ' + e.message);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`${API_BASE}/incidents/incident-rules/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchRules();
        setError(null);
      } else {
        setError(data.error.message || 'Failed to delete rule');
      }
    } catch (e) {
      setError('Error deleting rule: ' + e.message);
    }
  };

  const toggle = async (id, enabled) => {
    try {
      const res = await fetch(`${API_BASE}/incidents/incident-rules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchRules();
        setError(null);
      } else {
        setError(data.error.message || 'Failed to toggle rule');
      }
    } catch (e) {
      setError('Error toggling rule: ' + e.message);
    }
  };

  /* ----------------------------------------------------------------
   * EDIT EXISTING RULE
   * ---------------------------------------------------------------- */
  const startEdit = (rule) => {
    const newConditions = [];
    let conditionId = 1;
    const addedConditions = new Set();

    Object.keys(CONDITION_FIELDS).forEach((field) => {
      if (rule.conditions?.[`${field}_contains`]?.length) {
        rule.conditions[`${field}_contains`].forEach((value) => {
          const key = `${field}-contains-${value}`;
          if (!addedConditions.has(key)) {
            newConditions.push({
              id: conditionId++,
              field,
              operator: 'contains',
              value,
            });
            addedConditions.add(key);
          }
        });
      }

      if (rule.conditions?.[`${field}_exact`]) {
        const key = `${field}-equals-${rule.conditions[`${field}_exact`]}`;
        if (!addedConditions.has(key)) {
          newConditions.push({
            id: conditionId++,
            field,
            operator: 'equals',
            value: rule.conditions[`${field}_exact`],
          });
          addedConditions.add(key);
        }
      }

      if (rule.conditions?.[`${field}_regex`]) {
        const key = `${field}-regex-${rule.conditions[`${field}_regex`]}`;
        if (!addedConditions.has(key)) {
          newConditions.push({
            id: conditionId++,
            field,
            operator: 'regex',
            value: rule.conditions[`${field}_regex`],
          });
          addedConditions.add(key);
        }
      }
    });

    if (rule.conditions?.network) {
      const key = `network-contains-${rule.conditions.network}`;
      if (!addedConditions.has(key)) {
        newConditions.push({
          id: conditionId++,
          field: 'network',
          operator: 'contains',
          value: rule.conditions.network,
        });
        addedConditions.add(key);
      }
    }

    setForm({
      system_mapping_id: rule.system_mapping_id || rule.system_mapping?._id || '',
      rule_name: rule.rule_name || '',
      description: rule.description || '',
      conditions: newConditions,
      logic_operator: rule.logic_operator || 'OR',
      incident_overrides:
        rule.incident_overrides || {
          short_description: '',
          description: '',
          u_system_failure: false,
        },
      enabled: rule.enabled !== false,
    });

    setEditingItem(rule);
    setShowForm(true);

    setTimeout(() => {
      document
        .getElementById('rule-form')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  /* ----------------------------------------------------------------
   * HELPERS
   * ---------------------------------------------------------------- */
  const renderApplicationChip = (pattern, idx) => {
    const p =
      typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
    const type = p.type || 'exact';
    const colorsForType = PATTERN_COLORS[type] || PATTERN_COLORS.exact;

    return (
      <span
        key={`${p.value}-${idx}`}
        style={{
          background: colors.bg.tertiary,
          color: colors.text.primary,
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          border: `1px solid ${colors.border.primary}`,
          borderLeft: `3px solid ${colorsForType.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: type === 'regex' ? 'monospace' : 'inherit',
        }}
      >
        <span style={{ opacity: 0.7 }}>
          {type === 'regex' ? '⚡' : type === 'contains' ? '🔍' : '🎯'}
        </span>
        <span>{p.value}</span>
      </span>
    );
  };

  /* ----------------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          background: gradients.neutralSoftGradient,
          borderRadius: 12,
          border: `2px solid ${colors.border.primary}`,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <RefreshCw
            size={32}
            style={{
              animation: 'spin 1s linear infinite',
              color: colors.brand.purple,
              marginBottom: 16,
            }}
          />
          <div
            style={{
              fontSize: 18,
              color: colors.text.secondary,
              fontWeight: 500,
            }}
          >
            Loading rules...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '100%',
        margin: '0 auto',
        color: colors.text.primary,
      }}
    >
      {/* ERROR BANNER */}
      {error && (
        <div
          style={{
            background: gradients.errorGradient,
            border: `2px solid ${colors.semantic.error}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={20} color={colors.semantic.errorText} />
          <div>
            <div
              style={{
                fontWeight: 600,
                color: colors.semantic.errorText,
                marginBottom: 4,
              }}
            >
              Error
            </div>
            <div
              style={{
                color: colors.semantic.errorText,
                fontSize: 14,
              }}
            >
              {String(error)}
            </div>
          </div>

          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: colors.semantic.errorText,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          padding: '0 8px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: colors.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Target size={28} color={colors.text.primary} />
          Incident Rules
        </h2>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              reset();
              setShowForm((prev) => !prev);
            }}
            style={{
              background: showForm
                ? gradients.warningGradient
                : gradients.infoGradient,
              color: colors.text.primary,
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cancel' : 'Create Rule'}
          </button>

          <button
            onClick={fetchRules}
            style={{
              background: colors.bg.secondary,
              color: colors.text.secondary,
              border: `2px solid ${colors.border.secondary}`,
              borderRadius: 12,
              padding: '12px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
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
            background: colors.bg.secondary,
            borderRadius: 16,
            padding: 32,
            marginBottom: 32,
            border: `1px solid ${colors.border.primary}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: gradients.headerBarGradient,
            }}
          />

          <div style={{ marginTop: 8 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 24,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: 24,
                    fontWeight: 700,
                    color: colors.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  {editingItem ? <Edit size={24} /> : <Plus size={24} />}
                  {editingItem ? 'Update Rule' : 'Create Rule'}
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: colors.text.secondary,
                    fontSize: 16,
                  }}
                >
                  Set up conditions for when this rule should trigger
                </p>
              </div>

              <button
                type="button"
                style={{
                  background: previewMode ? colors.semantic.success : colors.bg.secondary,
                  color: previewMode ? colors.text.inverse : colors.text.secondary,
                  border: `2px solid ${colors.border.secondary}`,
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                onClick={() => setPreviewMode((prev) => !prev)}
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
                gap: 32,
              }}
            >
              {/* BASIC INFO */}
              <div
                style={{
                  background: gradients.neutralSoftGradient,
                  padding: 24,
                  borderRadius: 12,
                  border: `2px solid ${colors.border.secondary}`,
                }}
              >
                <h4
                  style={{
                    margin: '0 0 20px 0',
                    fontSize: 18,
                    fontWeight: 600,
                    color: colors.text.primary,
                  }}
                >
                  Rule Setup
                </h4>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 20,
                  }}
                >
                  {/* SYSTEM MAPPING */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.text.primary,
                        marginBottom: 8,
                      }}
                    >
                      Base System Mapping *
                    </label>
                    <select
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.border.secondary}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      required
                      value={form.system_mapping_id}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          system_mapping_id: e.target.value,
                        }))
                      }
                    >
                      <option value="">Choose a system mapping...</option>

                      {mappings.map((m) => (
                        <option key={String(m._id)} value={m._id}>
                          {m.grafana_names
                            ?.map((name) =>
                              typeof name === 'object' ? name.value : name
                            )
                            .join(', ')}{' '}
                          ← {m.service_offering}
                        </option>
                      ))}
                    </select>

                    {selectedMapping && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 12,
                          color: colors.text.secondary,
                        }}
                      >
                        Applies to:{' '}
                        <strong>
                          {(selectedMapping.grafana_names || []).map((g) =>
                            typeof g === 'string' ? g : g.value
                          ).join(', ')}
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
                        color: colors.text.primary,
                        marginBottom: 8,
                      }}
                    >
                      Rule Name *
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.border.secondary}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      required
                      value={form.rule_name}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          rule_name: e.target.value,
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
                        color: colors.text.primary,
                        marginBottom: 8,
                      }}
                    >
                      Description
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.border.secondary}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      value={String(form.description || '')}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          description: e.target.value,
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
                  background: gradients.infoGradient,
                  padding: 24,
                  borderRadius: 12,
                  border: `2px solid ${colors.semantic.info}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      color: colors.semantic.infoText,
                    }}
                  >
                    WHEN Alert Matches…
                  </h4>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    {/* LOGIC SWITCH */}
                    <div
                      style={{
                        display: 'flex',
                        background: colors.bg.secondary,
                        borderRadius: 8,
                        border: `2px solid ${colors.border.secondary}`,
                        overflow: 'hidden',
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
                              ? colors.semantic.info
                              : colors.bg.secondary,
                          color:
                            form.logic_operator === 'OR'
                              ? colors.text.inverse
                              : colors.semantic.infoText,
                          border: 'none',
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
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
                              ? colors.semantic.info
                              : colors.bg.secondary,
                          color:
                            form.logic_operator === 'AND'
                              ? colors.text.inverse
                              : colors.semantic.infoText,
                          border: 'none',
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        AND
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={addCondition}
                      style={{
                        background: colors.semantic.success,
                        color: colors.text.inverse,
                        border: 'none',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
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
                      background: colors.bg.secondary,
                      padding: 32,
                      borderRadius: 8,
                      textAlign: 'center',
                      border: `2px dashed ${colors.border.secondary}`,
                    }}
                  >
                    <Filter
                      size={48}
                      color={colors.semantic.info}
                      style={{ marginBottom: 16 }}
                    />
                    <button
                      type="button"
                      onClick={addCondition}
                      style={{
                        background: colors.semantic.info,
                        color: colors.text.inverse,
                        border: 'none',
                        borderRadius: 8,
                        padding: '12px 24px',
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Add Your First Condition
                    </button>
                  </div>
                )}

                {/* CONDITIONS LIST */}
                {form.conditions.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {form.conditions.map((condition, index) => (
                      <div key={String(condition.id)}>
                        <div
                          style={{
                            background: colors.bg.secondary,
                            padding: 20,
                            borderRadius: 8,
                            border: `2px solid ${colors.semantic.info}`,
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              top: -1,
                              left: 16,
                              background: colors.semantic.info,
                              color: colors.text.inverse,
                              padding: '4px 12px',
                              borderRadius: '0 0 8px 8px',
                              fontSize: 12,
                              fontWeight: 600,
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
                              marginTop: 12,
                            }}
                          >
                            {/* FIELD */}
                            <select
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: `1px solid ${colors.border.secondary}`,
                                borderRadius: 6,
                                fontSize: 14,
                                background: colors.bg.secondary,
                                color: colors.text.primary,
                              }}
                              value={condition.field}
                              onChange={(e) =>
                                updateCondition(condition.id, {
                                  field: e.target.value,
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
                                border: `1px solid ${colors.border.secondary}`,
                                borderRadius: 6,
                                fontSize: 14,
                                background: colors.bg.secondary,
                                color: colors.text.primary,
                              }}
                              value={condition.operator}
                              onChange={(e) =>
                                updateCondition(condition.id, {
                                  operator: e.target.value,
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
                                border: `1px solid ${colors.border.secondary}`,
                                borderRadius: 6,
                                fontSize: 14,
                                background: colors.bg.secondary,
                                color: colors.text.primary,
                              }}
                              value={String(condition.value || '')}
                              onChange={(e) =>
                                updateCondition(condition.id, {
                                  value: e.target.value,
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
                                background: colors.semantic.error,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 6,
                                padding: '8px',
                                cursor: 'pointer',
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
                              padding: '8px 0',
                            }}
                          >
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                background:
                                  form.logic_operator === 'OR'
                                    ? colors.semantic.warningBg
                                    : colors.semantic.infoBg,
                                color:
                                  form.logic_operator === 'OR'
                                    ? colors.semantic.warningText
                                    : colors.semantic.infoText,
                                padding: '4px 12px',
                                borderRadius: 20,
                                fontSize: 12,
                                fontWeight: 700,
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

              {/* INCIDENT OVERRIDES */}
              <div
                style={{
                  background: gradients.successGradient,
                  padding: 24,
                  borderRadius: 12,
                  border: `2px solid ${colors.semantic.success}`,
                }}
              >
                <h4
                  style={{
                    margin: '0 0 20px 0',
                    fontSize: 18,
                    fontWeight: 600,
                    color: colors.semantic.successText,
                  }}
                >
                  THEN Override Incident Fields...
                </h4>

                <div
                  style={{
                    background: colors.bg.secondary,
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 20,
                    border: `1px solid ${colors.semantic.success}`,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      color: colors.semantic.successText,
                      fontWeight: 500,
                    }}
                  >
                    💡 Template Variables:{' '}
                    <code
                      style={{
                        background: colors.semantic.successBg,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}
                    >
                      {'{{ application }}'}
                    </code>
                    <code
                      style={{
                        background: colors.semantic.successBg,
                        padding: '2px 6px',
                        borderRadius: 4,
                        marginLeft: 4,
                      }}
                    >
                      {'{{ object_name }}'}
                    </code>
                    <code
                      style={{
                        background: colors.semantic.successBg,
                        padding: '2px 6px',
                        borderRadius: 4,
                        marginLeft: 4,
                      }}
                    >
                      {'{{ node_name }}'}
                    </code>
                    <code
                      style={{
                        background: colors.semantic.successBg,
                        padding: '2px 6px',
                        borderRadius: 4,
                        marginLeft: 4,
                      }}
                    >
                      {'{{ message }}'}
                    </code>
                    <code
                      style={{
                        background: colors.semantic.successBg,
                        padding: '2px 6px',
                        borderRadius: 4,
                        marginLeft: 4,
                      }}
                    >
                      {'{{ operator }}'}
                    </code>
                    <code
                      style={{
                        background: colors.semantic.successBg,
                        padding: '2px 6px',
                        borderRadius: 4,
                        marginLeft: 4,
                      }}
                    >
                      {'{{ network }}'}
                    </code>
                  </p>
                </div>

                {!selectedMapping && (
                  <div
                    style={{
                      background: colors.semantic.warningBg,
                      padding: 16,
                      borderRadius: 8,
                      border: `2px solid ${colors.semantic.warning}`,
                      marginBottom: 20,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        color: colors.semantic.warningText,
                      }}
                    >
                      ⚠️ Select a system mapping first to see available fields and their base
                      values
                    </p>
                  </div>
                )}

                {/* Standard Override Fields */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        marginBottom: 8,
                      }}
                    >
                      Short Description
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.semantic.success}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      value={form.incident_overrides.short_description || ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          incident_overrides: {
                            ...p.incident_overrides,
                            short_description: e.target.value,
                          },
                        }))
                      }
                      placeholder="Alert: {{object_name}} on {{node_name}}"
                    />
                    {selectedMapping && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: colors.semantic.successText,
                        }}
                      >
                        📋 Base:{' '}
                        <strong>
                          {selectedMapping.short_description ||
                            'קפצה התראה על: {{object_name}} - {{application}}'}
                        </strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        marginBottom: 8,
                      }}
                    >
                      Assignment Group
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.semantic.success}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      value={form.incident_overrides.assignment_group || ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          incident_overrides: {
                            ...p.incident_overrides,
                            assignment_group: e.target.value,
                          },
                        }))
                      }
                      placeholder="Override assignment group"
                    />
                    {selectedMapping && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: colors.semantic.successText,
                        }}
                      >
                        📋 Base:{' '}
                        <strong>{selectedMapping.assignment_group || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        marginBottom: 8,
                      }}
                    >
                      Service Offering
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.semantic.success}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      value={form.incident_overrides.service_offering || ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          incident_overrides: {
                            ...p.incident_overrides,
                            service_offering: e.target.value,
                          },
                        }))
                      }
                      placeholder="Override service offering"
                    />
                    {selectedMapping && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: colors.semantic.successText,
                        }}
                      >
                        📋 Base:{' '}
                        <strong>{selectedMapping.service_offering || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        marginBottom: 8,
                      }}
                    >
                      Business Service
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.semantic.success}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      value={form.incident_overrides.business_service || ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          incident_overrides: {
                            ...p.incident_overrides,
                            business_service: e.target.value,
                          },
                        }))
                      }
                      placeholder="Override business service"
                    />
                    {selectedMapping && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: colors.semantic.successText,
                        }}
                      >
                        📋 Base:{' '}
                        <strong>{selectedMapping.business_service || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        marginBottom: 8,
                      }}
                    >
                      Network
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.semantic.success}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      value={form.incident_overrides.u_network || ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          incident_overrides: {
                            ...p.incident_overrides,
                            u_network: e.target.value,
                          },
                        }))
                      }
                      placeholder="Override network (e.g., PROD, QA)"
                    />
                    {selectedMapping && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: colors.semantic.successText,
                        }}
                      >
                        📋 Base:{' '}
                        <strong>{selectedMapping.u_network || '—'}</strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        marginBottom: 8,
                      }}
                    >
                      Impact Technology
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.semantic.success}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                      }}
                      value={form.incident_overrides.u_impact_technology || ''}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          incident_overrides: {
                            ...p.incident_overrides,
                            u_impact_technology: e.target.value,
                          },
                        }))
                      }
                      placeholder="Override impact technology"
                    />
                    {selectedMapping && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: 12,
                          color: colors.semantic.successText,
                        }}
                      >
                        📋 Base:{' '}
                        <strong>
                          {selectedMapping.u_impact_technology || '—'}
                        </strong>
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.incident_overrides.u_system_failure || false}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            incident_overrides: {
                              ...p.incident_overrides,
                              u_system_failure: e.target.checked,
                            },
                          }))
                        }
                        style={{ width: 18, height: 18 }}
                      />
                      System Failure
                    </label>
                    <p
                      style={{
                        margin: '4px 0 0 30px',
                        fontSize: 12,
                        color: colors.semantic.successText,
                      }}
                    >
                      Creates outage automatically
                    </p>
                    {selectedMapping && (
                      <p
                        style={{
                          margin: '4px 0 0 30px',
                          fontSize: 12,
                          color: colors.semantic.successText,
                        }}
                      >
                        📋 Base:{' '}
                        <strong>
                          {selectedMapping.u_system_failure ? 'YES' : 'NO'}
                        </strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Full Description */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: colors.semantic.successText,
                      marginBottom: 8,
                    }}
                  >
                    Description (Full)
                  </label>
                  <textarea
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `2px solid ${colors.semantic.success}`,
                      borderRadius: 8,
                      fontSize: 14,
                      background: colors.bg.secondary,
                      color: colors.text.primary,
                      minHeight: 120,
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                    value={form.incident_overrides.description || ''}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        incident_overrides: {
                          ...p.incident_overrides,
                          description: e.target.value,
                        },
                      }))
                    }
                    placeholder={
                      'Full incident description with template variables...\nExample:\nAlert: {{object_name}} on {{node_name}}\nMessage: {{message}}\nOperator: {{operator}}'
                    }
                  />
                  {selectedMapping && (
                    <p
                      style={{
                        margin: '4px 0 0 0',
                        fontSize: 12,
                        color: colors.semantic.successText,
                      }}
                    >
                      📋 Base:{' '}
                      <strong>
                        {selectedMapping.description || 'ההתראה: Message: {{message}}'}
                      </strong>
                    </p>
                  )}
                </div>

                {/* Custom fields for selected mapping */}
                {customFieldsInMapping.length > 0 && (
                  <div
                    style={{
                      background: gradients.neutralSoftGradient,
                      padding: 20,
                      borderRadius: 8,
                      border: `2px solid ${colors.brand.purple}`,
                    }}
                  >
                    <h5
                      style={{
                        margin: '0 0 16px 0',
                        fontSize: 16,
                        fontWeight: 600,
                        color: colors.brand.purple,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      ⚙️ Custom Fields ({customFieldsInMapping.length})
                    </h5>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                        gap: 16,
                      }}
                    >
                      {customFieldsInMapping.map((fieldName) => (
                        <div key={fieldName}>
                          <label
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: colors.brand.purple,
                              marginBottom: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span style={{ fontFamily: 'monospace' }}>{fieldName}</span>
                          </label>
                          <input
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: `2px solid ${colors.brand.purple}`,
                              borderRadius: 8,
                              fontSize: 14,
                              background: colors.bg.secondary,
                              color: colors.text.primary,
                            }}
                            value={form.incident_overrides[fieldName] || ''}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                  ...p.incident_overrides,
                                  [fieldName]: e.target.value,
                                },
                              }))
                            }
                            placeholder={`Override ${fieldName} (optional)`}
                          />
                          <p
                            style={{
                              margin: '4px 0 0 0',
                              fontSize: 12,
                              color: colors.brand.purple,
                            }}
                          >
                            📋 Base value:{' '}
                            <strong style={{ fontFamily: 'monospace' }}>
                              {selectedMapping?.[fieldName] || '—'}
                            </strong>
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
                  borderTop: `2px solid ${colors.border.primary}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setShowForm(false);
                  }}
                  style={{
                    background: colors.bg.secondary,
                    color: colors.text.secondary,
                    border: `2px solid ${colors.border.secondary}`,
                    borderRadius: 8,
                    padding: '12px 24px',
                    fontSize: 16,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    background: colors.brand.purple,
                    color: colors.text.inverse,
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 32px',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: form.conditions.length === 0 ? 0.5 : 1,
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
            background: colors.bg.secondary,
            border: `3px dashed ${colors.border.secondary}`,
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h3
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: colors.brand.purple,
              marginBottom: 12,
            }}
          >
            No Rules Yet
          </h3>
          <p
            style={{
              fontSize: 16,
              color: colors.text.secondary,
              marginBottom: 24,
              maxWidth: 480,
              margin: '0 auto',
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
              padding: '0 8px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 600,
                color: colors.text.primary,
              }}
            >
              Your Rules ({rules.length})
            </h3>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {rules.map((rule) => {
              const ruleMapping = rule.system_mapping;

              const customFieldsInRule = ruleMapping
                ? Object.keys(ruleMapping).filter(
                    (k) => !EXCLUDED_MAPPING_FIELDS.includes(k)
                  )
                : [];

              return (
                <div
                  key={String(rule._id)}
                  style={{
                    background: colors.bg.secondary,
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: colors.shadow.md,
                    border: `1px solid ${colors.border.primary}`,
                    position: 'relative',
                    overflow: 'hidden',
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
                        ? colors.semantic.success
                        : colors.border.secondary,
                    }}
                  />

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 20,
                      marginTop: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginBottom: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <h4
                          style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 700,
                            color: colors.text.primary,
                          }}
                        >
                          {String(rule.rule_name)}
                        </h4>

                        {/* STATUS BADGE */}
                        <div
                          style={{
                            background: rule.enabled
                              ? colors.semantic.successBg
                              : colors.bg.tertiary,
                            color: rule.enabled
                              ? colors.semantic.successText
                              : colors.text.secondary,
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
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
                            background: colors.semantic.infoBg,
                            color: colors.semantic.infoText,
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {String(rule.logic_operator || 'OR')} Logic
                        </div>

                        {/* CUSTOM FIELDS COUNT */}
                        {customFieldsInRule.length > 0 && (
                          <div
                            style={{
                              background: colors.bg.tertiary,
                              color: colors.brand.purple,
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {customFieldsInRule.length} Custom Field
                            {customFieldsInRule.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>

                      {/* APPLICATIONS */}
                      <p
                        style={{
                          margin: '0 0 8px 0',
                          fontSize: 14,
                          color: colors.text.secondary,
                        }}
                      >
                        <strong>Applications: </strong>
                        {(rule.grafana_names || []).map((pattern, idx) =>
                          renderApplicationChip(pattern, idx)
                        )}
                      </p>

                      {/* DESCRIPTION */}
                      {rule.description && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: 13,
                            color: colors.text.secondary,
                            fontStyle: 'italic',
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
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* ENABLE / DISABLE */}
                      <button
                        onClick={() => toggle(rule._id, !Boolean(rule.enabled))}
                        style={{
                          background: rule.enabled
                            ? colors.semantic.warning
                            : colors.semantic.success,
                          color: colors.text.inverse,
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
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
                          background: colors.semantic.info,
                          color: colors.text.inverse,
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Edit size={12} />
                        Edit
                      </button>

                      {/* DELETE */}
                      <button
                        onClick={() => del(rule._id)}
                        style={{
                          background: colors.semantic.error,
                          color: colors.text.inverse,
                          border: 'none',
                          borderRadius: 8,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
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
                      background: gradients.infoGradient,
                      padding: 16,
                      borderRadius: 8,
                      marginBottom: 16,
                      border: `2px solid ${colors.semantic.info}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.infoText,
                        marginBottom: 12,
                      }}
                    >
                      Conditions ({String(rule.logic_operator || 'OR')} Logic)
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {Object.entries(rule.conditions || {}).map(([key, value]) => {
                        if (Array.isArray(value)) {
                          return value.map((v, idx) => (
                            <div
                              key={`${String(key)}-${idx}`}
                              style={{
                                background: colors.bg.secondary,
                                padding: 8,
                                borderRadius: 4,
                                border: `1px solid ${colors.border.secondary}`,
                                fontSize: 12,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: colors.semantic.infoText,
                                }}
                              >
                                {String(key).replace(/_/g, ' ')}:
                              </span>
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontFamily: 'monospace',
                                  color: colors.text.primary,
                                }}
                              >
                                "{String(v)}"
                              </span>
                            </div>
                          ));
                        }

                        if (value && typeof value === 'string') {
                          const isRegex = String(key).includes('regex');
                          return (
                            <div
                              key={String(key)}
                              style={{
                                background: colors.bg.secondary,
                                padding: 8,
                                borderRadius: 4,
                                border: `1px solid ${colors.border.secondary}`,
                                fontSize: 12,
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: colors.semantic.infoText,
                                }}
                              >
                                {String(key).replace(/_/g, ' ')}:
                              </span>

                              <span
                                style={{
                                  marginLeft: 8,
                                  fontFamily: 'monospace',
                                  color: colors.text.primary,
                                }}
                              >
                                {isRegex ? `/${String(value)}/` : `"${String(value)}"`}
                              </span>
                            </div>
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>

                  {/* OVERRIDES DISPLAY */}
                  {rule.incident_overrides &&
                    Object.keys(rule.incident_overrides).length > 0 && (
                      <div
                        style={{
                          background: gradients.successGradient,
                          padding: 16,
                          borderRadius: 8,
                          marginBottom: 16,
                          border: `2px solid ${colors.semantic.success}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 12,
                          }}
                        >
                          Incident Overrides
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns:
                              'repeat(auto-fit, minmax(250px, 1fr))',
                            gap: 8,
                          }}
                        >
                          {Object.entries(rule.incident_overrides)
                            .filter(([k]) => k !== 'description')
                            .map(([k, v]) => (
                              <div
                                key={String(k)}
                                style={{
                                  background:
                                    k === 'u_system_failure'
                                      ? colors.semantic.errorBg
                                      : customFieldsInRule.includes(k)
                                      ? colors.bg.tertiary
                                      : colors.bg.secondary,
                                  padding: 8,
                                  borderRadius: 4,
                                  border:
                                    k === 'u_system_failure'
                                      ? `1px solid ${colors.semantic.error}`
                                      : customFieldsInRule.includes(k)
                                      ? `1px solid ${colors.brand.purple}`
                                      : `1px solid ${colors.semantic.success}`,
                                  fontSize: 12,
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color:
                                      k === 'u_system_failure'
                                        ? colors.semantic.errorText
                                        : customFieldsInRule.includes(k)
                                        ? colors.brand.purple
                                        : colors.semantic.successText,
                                  }}
                                >
                                  {String(k).replace(/_/g, ' ')}:
                                </span>

                                <div
                                  style={{
                                    marginTop: 4,
                                    color:
                                      k === 'u_system_failure'
                                        ? colors.semantic.errorText
                                        : customFieldsInRule.includes(k)
                                        ? colors.brand.purple
                                        : colors.semantic.successText,
                                    fontWeight:
                                      k === 'u_system_failure' ? 600 : 'normal',
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
                                color: colors.semantic.successText,
                                marginBottom: 4,
                              }}
                            >
                              Description template:
                            </div>

                            <div
                              style={{
                                background: colors.bg.secondary,
                                border: `1px solid ${colors.semantic.success}`,
                                borderRadius: 4,
                                padding: 10,
                                whiteSpace: 'pre-wrap',
                                maxHeight: 120,
                                overflow: 'auto',
                                fontSize: 11,
                                color: colors.semantic.successText,
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
                        borderTop: `1px solid ${colors.border.primary}`,
                        fontSize: 12,
                        color: colors.text.tertiary,
                      }}
                    >
                      Created: {new Date(rule.created_at).toLocaleString()}
                      {rule.updated_at && rule.updated_at !== rule.created_at && (
                        <span>
                          {' '}
                          • Updated:{' '}
                          {new Date(rule.updated_at).toLocaleString()}
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
