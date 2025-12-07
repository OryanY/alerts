import { useEffect, useState } from 'react';
import {
  Plus,
  Edit,
  X,
  Search,
  Zap,
  Check,
  PlusCircle,
  MinusCircle,
  Target,
} from 'lucide-react';
import { API_BASE } from '../../utils/constants';

const baseMandatoryFields = [
  'service_offering',
  'business_service',
  'u_network',
  'u_impact_technology',
  'assignment_group',
  'u_system_failure',
];

const excludeFromCustom = [
  '_id',
  'grafana_names',
  'created_at',
  'updated_at',
  ...baseMandatoryFields,
];

const withAlpha = (hex, alpha = '20') => `${hex}${alpha}`;

const IncidentMappingsForm = ({
  colors,
  gradients,
  PATTERN_TYPES,
  PATTERN_COLORS,
  assignmentGroups,
  loadingGroups,
  editingItem,
  onSaved,
  onCancel,
  onError,
}) => {
  const [form, setForm] = useState({
    grafana_names: [],
    service_offering: '',
    business_service: '',
    u_network: '',
    u_impact_technology: '',
    assignment_group: '',
    u_system_failure: false,
  });

  const [customFields, setCustomFields] = useState({});
  const [newPattern, setNewPattern] = useState({ value: '', type: 'exact' });
  const [testInput, setTestInput] = useState('');

  const resetLocal = () => {
    setForm({
      grafana_names: [],
      service_offering: '',
      business_service: '',
      u_network: '',
      u_impact_technology: '',
      assignment_group: '',
      u_system_failure: false,
    });
    setCustomFields({});
    setNewPattern({ value: '', type: 'exact' });
    setTestInput('');
  };

  useEffect(() => {
    if (!editingItem) {
      resetLocal();
      return;
    }

    const patterns = (editingItem.grafana_names || []).map((item) => {
      if (typeof item === 'string') {
        return { value: item, type: 'exact' };
      }
      return item;
    });

    const formData = {
      grafana_names: patterns,
      service_offering: editingItem.service_offering || '',
      business_service: editingItem.business_service || '',
      u_network: editingItem.u_network || '',
      u_impact_technology: editingItem.u_impact_technology || '',
      assignment_group: editingItem.assignment_group || '',
      u_system_failure: Boolean(editingItem.u_system_failure),
    };

    setForm(formData);

    const custom = {};
    Object.keys(editingItem).forEach((key) => {
      if (!excludeFromCustom.includes(key)) {
        custom[key] = editingItem[key] || '';
      }
    });

    setCustomFields(custom);
  }, [editingItem]);

  // ================== PATTERN MANAGEMENT ==================

  const addPattern = () => {
    const trimmed = newPattern.value.trim();

    if (!trimmed) {
      alert('Please enter a pattern value');
      return;
    }

    // Validate regex BEFORE normalization
    if (newPattern.type === 'regex') {
      try {
        new RegExp(trimmed);
      } catch (e) {
        alert(`Invalid regex pattern: ${e.message}`);
        return;
      }
    }

    if (newPattern.type === 'exact' && !/^[a-z0-9_-]+$/i.test(trimmed)) {
      alert('Exact match can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    // CRITICAL FIX: Only normalize exact matches
    const normalizedValue = newPattern.type === 'exact' 
      ? trimmed.toLowerCase() 
      : trimmed; // Keep regex as-is

    const isDuplicate = form.grafana_names.some(
      (p) => {
        const compareValue = p.type === 'exact' ? p.value.toLowerCase() : p.value;
        const compareNew = newPattern.type === 'exact' ? normalizedValue : trimmed;
        return compareValue === compareNew && p.type === newPattern.type;
      }
    );

    if (isDuplicate) {
      alert('This pattern already exists');
      return;
    }

    setForm((prev) => ({
      ...prev,
      grafana_names: [
        ...prev.grafana_names,
        {
          value: normalizedValue,
          type: newPattern.type,
        },
      ],
    }));
    setNewPattern({ value: '', type: 'exact' });
  };

  const removePattern = (index) => {
    setForm((prev) => ({
      ...prev,
      grafana_names: prev.grafana_names.filter((_, i) => i !== index),
    }));
  };

  const handlePatternKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPattern();
    }
  };

  const testPattern = (pattern, input) => {
  if (!input) return false;

  switch (pattern.type) {
    case 'exact':
      // Case-insensitive exact match
      return input.toLowerCase() === pattern.value.toLowerCase();
      
    case 'contains':
      // Case-insensitive substring
      return input.toLowerCase().includes(pattern.value.toLowerCase());
      
    case 'regex':
      try {
        // Use the regex as-is, with case-insensitive flag
        const regex = new RegExp(pattern.value, 'i');
        return regex.test(input);
      } catch {
        return false;
      }
      
    default:
      return false;
  }
  };

  const testAllPatterns = () => {
    if (!testInput.trim()) return null;
    const matches = form.grafana_names.filter((p) => testPattern(p, testInput));
    return matches.length > 0 ? matches : null;
  };

  const matchResult = testAllPatterns();

  // ================== CUSTOM FIELDS ==================

  const addCustomField = () => {
    const fieldName = prompt('Enter field name (e.g., u_eck_name, u_oracle_error):');
    if (!fieldName) return;

    const sanitized = fieldName.trim().toLowerCase().replace(/\s+/g, '_');

    if (excludeFromCustom.includes(sanitized)) {
      alert('This field name is reserved or already exists as a base field');
      return;
    }

    if (customFields[sanitized] !== undefined) {
      alert('This custom field already exists');
      return;
    }

    setCustomFields((prev) => ({
      ...prev,
      [sanitized]: '',
    }));
  };

  const removeCustomField = (fieldName) => {
    setCustomFields((prev) => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  };

  const updateCustomField = (fieldName, value) => {
    setCustomFields((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  // ================== SAVE ==================

  const validateForm = () => {
    const errors = [];

    if (!form.grafana_names || form.grafana_names.length === 0) {
      errors.push('At least one Grafana application pattern is required');
    }

    form.grafana_names.forEach((pattern, idx) => {
      if (!pattern.value || !pattern.value.trim()) {
        errors.push(`Pattern ${idx + 1}: Value is required`);
      }
      
      if (pattern.type === 'regex') {
        try {
          new RegExp(pattern.value);
        } catch (e) {
          errors.push(`Pattern ${idx + 1}: Invalid regex - ${e.message}`);
        }
      }
    });

    const requiredFields = {
      service_offering: 'Service Offering',
      business_service: 'Business Service',
      u_network: 'Network',
      u_impact_technology: 'Impact Technology',
      assignment_group: 'Assignment Group',
    };

    Object.entries(requiredFields).forEach(([key, label]) => {
      if (!form[key] || !form[key].trim()) {
        errors.push(`${label} is required`);
      }
    });

    return errors;
  };

  const save = async (e) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      const errorMessage = 'Please fix the following errors:\n\n' + 
        validationErrors.map((err, i) => `${i + 1}. ${err}`).join('\n');
      
      onError?.(errorMessage);
      alert(errorMessage);
      return;
    }

    try {
      const dataToSave = {
        ...form,
        ...customFields,
        service_offering: form.service_offering?.trim(),
        business_service: form.business_service?.trim(),
        u_network: form.u_network?.trim(),
        u_impact_technology: form.u_impact_technology?.trim(),
        assignment_group: form.assignment_group?.trim(),
      };

      const url = editingItem
        ? `${API_BASE}/incidents/system-mappings/${editingItem._id}`
        : `${API_BASE}/incidents/system-mappings`;
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      
      const data = await res.json();

      if (data.success) {
        onSaved?.();
      } else {
        onError?.(data.error.message || 'Failed to save mapping');
      }
    } catch (e2) {
      onError?.('Error saving mapping: ' + e2.message);
    }
  };

  // ================== HELPERS ==================

  const renderPatternChip = (pattern, idx) => {
    const p = typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
    const colorsForType = PATTERN_COLORS[p.type] || PATTERN_COLORS.exact;

    return (
      <span
        key={idx}
        style={{
          background: colorsForType.softBg,
          color: colorsForType.main,
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: `1px solid ${colorsForType.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: p.type === 'regex' ? 'monospace' : 'inherit',
        }}
      >
        <span>{PATTERN_TYPES[p.type].icon}</span>
        <span>{p.value}</span>
      </span>
    );
  };

  // ================== RENDER ==================

  return (
    <div
      style={{
        background: colors.bg.secondary,
        borderRadius: 12,
        padding: 32,
        marginBottom: 32,
        border: `1px solid ${colors.border.primary}`,
        borderTop: `4px solid ${colors.brand.primary}`,
      }}
    >
      <div>
        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: 20,
            fontWeight: 600,
            color: colors.text.primary,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {editingItem ? (
            <Edit size={20} style={{ color: colors.brand.primary }} />
          ) : (
            <Plus size={20} style={{ color: colors.brand.primary }} />
          )}
          {editingItem ? 'Update Mapping' : 'Create New Mapping'}
        </h3>
        <p
          style={{
            margin: '0 0 32px 0',
            color: colors.text.secondary,
            fontSize: 14,
          }}
        >
          {editingItem
            ? 'Update how these applications create incidents'
            : 'Configure how alerts from Grafana applications create ServiceNow incidents.'}
        </p>

        <form
          onSubmit={save}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          {/* Grafana Application Patterns */}
          <div
            style={{
              background: withAlpha(colors.semantic.info, '08'),
              padding: 20,
              borderRadius: 10,
              border: `1px solid ${withAlpha(colors.semantic.info, '30')}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
              }}
            >
              <div>
                <h4
                  style={{
                    margin: '0 0 4px 0',
                    fontSize: 16,
                    fontWeight: 600,
                    color: colors.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Target size={16} style={{ color: colors.semantic.info }} />
                  Grafana Application Patterns
                </h4>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: colors.text.secondary,
                  }}
                >
                  Define which Grafana applications should use this mapping
                </p>
              </div>
            </div>

            {/* Pattern Input */}
            <div
              style={{
                background: colors.bg.secondary,
                padding: 16,
                borderRadius: 8,
                border: `1px solid ${colors.border.primary}`,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr auto',
                  gap: 12,
                  alignItems: 'end',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: colors.text.secondary,
                      marginBottom: 6,
                    }}
                  >
                    Pattern Type
                  </label>
                  <select
                    value={newPattern.type}
                    onChange={(e) =>
                      setNewPattern((prev) => ({ ...prev, type: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `2px solid ${PATTERN_COLORS[newPattern.type].border}`,
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      background: PATTERN_COLORS[newPattern.type].softBg,
                      cursor: 'pointer',
                      color: PATTERN_COLORS[newPattern.type].main,
                    }}
                  >
                    {Object.entries(PATTERN_TYPES).map(([type, info]) => (
                      <option key={type} value={type}>
                        {info.icon} {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: colors.text.secondary,
                      marginBottom: 6,
                    }}
                  >
                    Pattern Value
                  </label>
                  <input
                    type="text"
                    value={newPattern.value}
                    onChange={(e) =>
                      setNewPattern((prev) => ({ ...prev, value: e.target.value }))
                    }
                    onKeyPress={handlePatternKeyPress}
                    placeholder={PATTERN_TYPES[newPattern.type].placeholder}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${colors.border.primary}`,
                      borderRadius: 6,
                      fontSize: 13,
                      background: colors.bg.secondary,
                      color: colors.text.primary,
                      fontFamily: newPattern.type === 'regex' ? 'monospace' : 'inherit',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={addPattern}
                  style={{
                    background: colors.semantic.info,
                    color: colors.text.inverse,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
            </div>

            {/* Pattern List */}
            {form.grafana_names.length > 0 ? (
              <div
                style={{
                  background: colors.bg.secondary,
                  padding: 16,
                  borderRadius: 8,
                  border: `1px solid ${colors.border.primary}`,
                  marginBottom: 16,
                }}
              >
                <h5
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: 13,
                    fontWeight: 500,
                    color: colors.text.secondary,
                  }}
                >
                  Active Patterns ({form.grafana_names.length})
                </h5>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {form.grafana_names.map((pattern, index) => {
                    const colorsForType = PATTERN_COLORS[pattern.type] || PATTERN_COLORS.exact;
                    
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: 10,
                          background: colorsForType.softBg,
                          borderRadius: 6,
                          border: `1px solid ${colorsForType.border}`,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>
                          {PATTERN_TYPES[pattern.type].icon}
                        </span>

                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: colorsForType.main,
                              marginBottom: 2,
                            }}
                          >
                            {PATTERN_TYPES[pattern.type].label}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontFamily:
                                pattern.type === 'regex' ? 'monospace' : 'inherit',
                              color: colors.text.primary,
                              fontWeight: 500,
                            }}
                          >
                            {pattern.value}
                          </div>
                        </div>

                        {testInput && testPattern(pattern, testInput) && (
                          <div
                            style={{
                              background: colors.semantic.success,
                              color: colors.text.inverse,
                              padding: '4px 8px',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <Check size={10} />
                            MATCH
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => removePattern(index)}
                          style={{
                            background: 'transparent',
                            color: colors.text.secondary,
                            border: 'none',
                            borderRadius: 4,
                            padding: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: colors.bg.secondary,
                  padding: 24,
                  borderRadius: 8,
                  border: `1px dashed ${colors.border.secondary}`,
                  textAlign: 'center',
                  color: colors.text.secondary,
                  marginBottom: 16,
                }}
              >
                <Search
                  size={24}
                  color={colors.text.tertiary}
                  style={{ marginBottom: 8 }}
                />
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                  }}
                >
                  No patterns added yet. Add at least one pattern to continue.
                </p>
              </div>
            )}

            {/* Pattern Tester */}
            <div
              style={{
                background: withAlpha(colors.brand.yellow, '15'),
                padding: 16,
                borderRadius: 8,
                border: `1px solid ${colors.brand.yellowBorder}`,
              }}
            >
              <h5
                style={{
                  margin: '0 0 10px 0',
                  fontSize: 13,
                  fontWeight: 600,
                  color: colors.text.primary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Zap size={14} style={{ color: colors.brand.yellowBorder }} />
                Test Pattern
              </h5>

              <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="e.g. mongodb-prod, db-cache-01"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: `1px solid ${colors.brand.yellowBorder}`,
                      borderRadius: 6,
                      fontSize: 13,
                      background: colors.bg.secondary,
                      color: colors.text.primary,
                    }}
                  />
                </div>

                {matchResult !== null && (
                  <div
                    style={{
                      background: matchResult
                        ? colors.semantic.success
                        : colors.semantic.error,
                      color: colors.text.inverse,
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {matchResult ? (
                      <>
                        <Check size={14} />
                        Matches {matchResult.length}
                      </>
                    ) : (
                      <>
                        <X size={14} />
                        No Match
                      </>
                    )}
                  </div>
                )}
              </div>

              {matchResult && matchResult.length > 0 && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    background: colors.bg.secondary,
                    borderRadius: 6,
                    border: `1px solid ${colors.border.primary}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: colors.text.secondary,
                      marginBottom: 6,
                    }}
                  >
                    Matching Patterns:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    {matchResult.map((p, i) => renderPatternChip(p, i))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Required Fields Section */}
          <div
            style={{
              background: withAlpha(colors.semantic.success, '08'),
              padding: 20,
              borderRadius: 10,
              border: `1px solid ${withAlpha(colors.semantic.success, '30')}`,
            }}
          >
            <h4
              style={{
                margin: '0 0 16px 0',
                fontSize: 16,
                fontWeight: 600,
                color: colors.text.primary,
              }}
            >
              Required ServiceNow Fields
            </h4>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: 16,
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: colors.text.secondary,
                    marginBottom: 6,
                  }}
                >
                  Assignment Group
                </label>
                <select
                  value={form.assignment_group}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      assignment_group: e.target.value,
                    }))
                  }
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: colors.bg.secondary,
                    border: `1px solid ${colors.border.primary}`,
                    color: colors.text.primary,
                    cursor: 'pointer',
                  }}
                >
                  <option value="">
                    {loadingGroups ? 'Loading groups...' : 'Select Assignment Group'}
                  </option>
                  {assignmentGroups.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: colors.text.secondary,
                    marginBottom: 6,
                  }}
                >
                  Business Service
                </label>
                <input
                  type="text"
                  value={form.business_service}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      business_service: e.target.value,
                    }))
                  }
                  placeholder="e.g. Payments, Billing"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: colors.bg.secondary,
                    border: `1px solid ${colors.border.primary}`,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: colors.text.secondary,
                    marginBottom: 6,
                  }}
                >
                  Service Offering
                </label>
                <input
                  type="text"
                  value={form.service_offering}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      service_offering: e.target.value,
                    }))
                  }
                  placeholder="e.g. API"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: colors.bg.secondary,
                    border: `1px solid ${colors.border.primary}`,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: colors.text.secondary,
                    marginBottom: 6,
                  }}
                >
                  Network
                </label>
                <input
                  type="text"
                  value={form.u_network}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      u_network: e.target.value,
                    }))
                  }
                  placeholder="e.g. PROD, QA, DEV"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: colors.bg.secondary,
                    border: `1px solid ${colors.border.primary}`,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 500,
                    color: colors.text.secondary,
                    marginBottom: 6,
                  }}
                >
                  Impact Technology
                </label>
                <input
                  type="text"
                  value={form.u_impact_technology}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      u_impact_technology: e.target.value,
                    }))
                  }
                  placeholder="e.g. Database, API"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    background: colors.bg.secondary,
                    border: `1px solid ${colors.border.primary}`,
                    color: colors.text.primary,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    color: colors.text.secondary,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.u_system_failure}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        u_system_failure: e.target.checked,
                      }))
                    }
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: colors.semantic.error,
                    }}
                  />
                  System Failure
                </label>
                <p
                  style={{
                    margin: '4px 0 0 26px',
                    fontSize: 12,
                    color: colors.text.tertiary,
                  }}
                >
                  Creates outage automatically
                </p>
              </div>
            </div>
          </div>

          {/* Custom Fields Section */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 600,
                  color: colors.text.primary,
                }}
              >
                Custom Fields ({Object.keys(customFields).length})
              </h4>
              <button
                type="button"
                onClick={addCustomField}
                style={{
                  background: colors.bg.tertiary,
                  color: colors.text.primary,
                  border: `1px solid ${colors.border.primary}`,
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <PlusCircle size={14} />
                Add Field
              </button>
            </div>

            {Object.keys(customFields).length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: colors.text.secondary,
                  fontSize: 13,
                  background: colors.bg.tertiary,
                  borderRadius: 8,
                  border: `1px dashed ${colors.border.secondary}`,
                }}
              >
                No custom fields yet
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {Object.entries(customFields).map(([fieldName, value]) => (
                  <div
                    key={fieldName}
                    style={{
                      background: colors.bg.tertiary,
                      padding: 12,
                      borderRadius: 6,
                      border: `1px solid ${colors.border.primary}`,
                      borderLeft: `3px solid ${colors.brand.purple}`,
                      display: 'grid',
                      gridTemplateColumns: '200px 1fr 40px',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: colors.text.primary,
                          fontFamily: 'monospace',
                        }}
                      >
                        {fieldName}
                      </div>
                    </div>

                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateCustomField(fieldName, e.target.value)}
                      placeholder="Custom field value or template"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        fontSize: 13,
                        background: colors.bg.secondary,
                        border: `1px solid ${colors.border.primary}`,
                        color: colors.text.primary,
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => removeCustomField(fieldName)}
                      style={{
                        background: 'transparent',
                        color: colors.text.secondary,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Remove field"
                    >
                      <MinusCircle size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form actions */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              paddingTop: 20,
              borderTop: `1px solid ${colors.border.primary}`,
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                background: colors.bg.secondary,
                color: colors.text.secondary,
                border: `1px solid ${colors.border.primary}`,
                borderRadius: 6,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.grafana_names.length === 0}
              style={{
                background:
                  form.grafana_names.length > 0
                    ? colors.brand.primary
                    : colors.bg.tertiary,
                color:
                  form.grafana_names.length > 0
                    ? colors.text.inverse
                    : colors.text.secondary,
                border: 'none',
                borderRadius: 6,
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: form.grafana_names.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {editingItem ? 'Update Mapping' : 'Create Mapping'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncidentMappingsForm;