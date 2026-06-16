// frontend/src/pages/IncidentRules.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { API_BASE } from '../utils/constants';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { CONDITION_FIELDS, EXCLUDED_MAPPING_FIELDS } from '../components/IncidentRules/constants';
import IncidentRulesHeader from '../components/IncidentRules/IncidentRulesHeader';
import EmptyState from '../components/IncidentRules/EmptyState';
import RuleCard from '../components/IncidentRules/RuleCard';
import RuleForm from '../components/IncidentRules/RuleForm';
import { safeJson } from '../utils/api';

const IncidentRules = () => {
  const { colors, gradients, PATTERN_COLORS } = useTheme();

  const [rules, setRules] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [assignmentGroups, setAssignmentGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('incident_rules_view_mode') || 'compact';
    } catch {
      return 'compact';
    }
  });

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'compact' ? 'expanded' : 'compact';
      try {
        localStorage.setItem('incident_rules_view_mode', next);
      } catch {}
      return next;
    });
  };

  // FILTERING LOGIC
  const filteredRules = useMemo(() => {
    if (!searchTerm) return rules;
    const lower = searchTerm.toLowerCase();

    return rules.filter(rule => {
      // 1. Basic Fields
      if (rule.rule_name?.toLowerCase().includes(lower)) return true;
      if (rule.description?.toLowerCase().includes(lower)) return true;

      // 2. Search in Conditions
      if (rule.conditions) {
        // Flatten values - rule.conditions could be { foo: ['bar'], baz: 'qux' }
        const values = Object.values(rule.conditions).flat();
        const match = values.some(val =>
          val && String(val).toLowerCase().includes(lower)
        );
        if (match) return true;
      }

      // 3. Search in Grafana Names (Rule level)
      if (rule.grafana_names && Array.isArray(rule.grafana_names)) {
        const match = rule.grafana_names.some(gn =>
          gn.value && String(gn.value).toLowerCase().includes(lower)
        );
        if (match) return true;
      }

      // 4. Search in Grafana Names (Mapping level - just in case)
      if (rule.system_mapping?.grafana_names && Array.isArray(rule.system_mapping.grafana_names)) {
        const match = rule.system_mapping.grafana_names.some(gn =>
          gn.value && String(gn.value).toLowerCase().includes(lower)
        );
        if (match) return true;
      }

      // 5. Overrides (Description etc)
      const overrides = rule.incident_overrides || {};
      if (overrides.description?.toLowerCase().includes(lower)) return true;
      if (overrides.short_description?.toLowerCase().includes(lower)) return true;

      return false;
    });
  }, [rules, searchTerm]);

  const [form, setForm] = useState({
    is_global: false,
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
      const res = await fetch(`${API_BASE}/incidents/incident-rules`, { credentials: 'include' });
      const data = await safeJson(res);
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
      const res = await fetch(`${API_BASE}/incidents/system-mappings`, { credentials: 'include' });
      const data = await safeJson(res);
      if (data.success) {
        const sortedMappings = (data.data || []).sort((a, b) =>
          String(a.service_offering || '').localeCompare(String(b.service_offering || ''))
        );
        setMappings(sortedMappings);
      }
    } catch (e) {
      console.warn('Failed to fetch mappings:', e);
    }
  };

  const fetchAssignmentGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/incidents/assignment-groups`, { credentials: 'include' });
      const data = await safeJson(res);
      if (data.success) {
        const sortedGroups = (data.data || []).sort((a, b) =>
          String(a.label || '').localeCompare(String(b.label || ''))
        );
        setAssignmentGroups(sortedGroups);
      }
    } catch (e) {
      console.warn('Failed to fetch assignment groups:', e);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchAssignmentGroups();
    fetchRules();
  }, []);

  /* ----------------------------------------------------------------
   * FORM HELPERS
   * ---------------------------------------------------------------- */
  const reset = () => {
    setForm({
      is_global: false,
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
        is_global: form.is_global,
        system_mapping_id: form.is_global ? undefined : form.system_mapping_id,
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
        credentials: 'include'
      });

      const data = await safeJson(res);

      if (data.success) {
        await fetchRules();
        reset();
        setShowForm(false);
        setError(null);
      } else {
        const errorMsg = data.error?.message || 'Failed to save rule';
        setError(errorMsg);
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
        credentials: 'include'
      });
      const data = await safeJson(res);
      if (data.success) {
        await fetchRules();
        setError(null);
      } else {
        const errorMsg = data.error?.message || 'Failed to delete rule';
        setError(errorMsg);
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
        credentials: 'include'
      });
      const data = await safeJson(res);
      if (data.success) {
        await fetchRules();
        setError(null);
      } else {
        const errorMsg = data.error?.message || 'Failed to toggle rule';
        setError(errorMsg);
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
      is_global: !!rule.is_global,
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
        maxWidth: '1000px',
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
      <IncidentRulesHeader
        showForm={showForm}
        onToggleForm={() => {
          reset();
          setShowForm((prev) => !prev);
        }}
        onRefresh={fetchRules}
        loading={loading}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
      />





      {/* FORM */}
      {showForm && (
        <RuleForm
          form={form}
          setForm={setForm}
          save={save}
          reset={reset}
          setShowForm={setShowForm}
          editingItem={editingItem}
          previewMode={previewMode}
          setPreviewMode={setPreviewMode}
          mappings={mappings}
          assignmentGroups={assignmentGroups}
          selectedMapping={selectedMapping}
          customFieldsInMapping={customFieldsInMapping}
        />
      )}

      {/* RULES LIST - ONLY SHOW WHEN NOT EDITING */}
      {!showForm && (
        <div style={{ marginTop: 24 }}>
          {/* If no rules at all (and no search), show empty state. If search active but no results, show 'no results' */}
          {rules.length === 0 ? (
            <EmptyState />
          ) : filteredRules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: colors.text.secondary }}>
              No rules match your search "{searchTerm}"
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
                  Found {filteredRules.length} Rules
                </h3>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 20,
                }}
              >
                {filteredRules.map((rule) => {
                  return (
                    <RuleCard
                      key={String(rule._id)}
                      rule={rule}
                      globalRules={rules.filter(r => r.is_global)} // Pass all global rules
                      assignmentGroups={assignmentGroups} // Pass for processing friendly names
                      onToggle={toggle}
                      onEdit={startEdit}
                      onDelete={del}
                      renderApplicationChip={renderApplicationChip}
                      viewMode={viewMode}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IncidentRules;
