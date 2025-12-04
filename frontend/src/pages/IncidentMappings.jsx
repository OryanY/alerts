import { useEffect, useState } from 'react';
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  PlusCircle,
  MinusCircle,
  Target,
  Zap,
  Search,
  Check,
} from 'lucide-react';
import { API_BASE } from '../utils/constants';
import { useTheme } from '../contexts/ThemeContext';

// Pattern types are semantic only (no colors here)
const PATTERN_TYPES = {
  exact: {
    label: 'Exact Match',
    icon: '🎯',
    description: 'Matches exactly this application name',
    example: 'mongo',
    placeholder: 'e.g., mongo, elasticsearch',
  },
  contains: {
    label: 'Contains',
    icon: '🔍',
    description: 'Matches any application containing this text',
    example: 'db (matches: mongodb, cassandra-db, db-prod)',
    placeholder: 'e.g., db, prod, cache',
  },
  regex: {
    label: 'Regex Pattern',
    icon: '⚡',
    description: 'Matches applications using regular expressions',
    example: '^db-.*$ (matches: db-prod, db-test)',
    placeholder: 'e.g., ^mongo.*, .*-prod$, db-[0-9]+',
  },
};

// Helper to add alpha to a hex from theme (e.g. "#3B82F6" + "20" = "#3B82F620")
const withAlpha = (hex, alpha = '20') => `${hex}${alpha}`;

const IncidentMappings = () => {
  const { colors } = useTheme();

  // Theme-aware pattern colors
  const PATTERN_COLORS = {
    exact: {
      main: colors.brand.primary,
      softBg: withAlpha(colors.brand.primary, '15'),
      strongBg: withAlpha(colors.brand.primary, '25'),
      border: colors.brand.primary,
    },
    contains: {
      main: colors.brand.purple,
      softBg: withAlpha(colors.brand.purple, '15'),
      strongBg: withAlpha(colors.brand.purple, '25'),
      border: colors.brand.purple,
    },
    regex: {
      main: colors.brand.yellow,
      softBg: withAlpha(colors.brand.yellow, '15'),
      strongBg: withAlpha(colors.brand.yellow, '25'),
      border: colors.brand.yellowBorder || colors.brand.yellow,
    },
  };
  // Simple themed gradient helpers
  const infoGradient = `linear-gradient(135deg, ${colors.semantic.infoBg} 0%, ${withAlpha(
    colors.semantic.info,
    '10'
  )} 100%)`;

  const warningGradient = `linear-gradient(135deg, ${colors.semantic.warningBg} 0%, ${withAlpha(
    colors.semantic.warning,
    '10'
  )} 100%)`;

  const successGradient = `linear-gradient(135deg, ${colors.semantic.successBg} 0%, ${withAlpha(
    colors.semantic.success,
    '10'
  )} 100%)`;

  const errorGradient = `linear-gradient(135deg, ${colors.semantic.errorBg} 0%, ${withAlpha(
    colors.semantic.error,
    '10'
  )} 100%)`;

  const neutralSoftGradient = `linear-gradient(135deg, ${colors.bg.secondary} 0%, ${colors.bg.tertiary} 100%)`;

  const headerBarGradient = `linear-gradient(90deg, ${colors.brand.primary}, ${colors.brand.purple}, ${colors.semantic.info})`;

  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [assignmentGroups, setAssignmentGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [testInput, setTestInput] = useState('');

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

  const reset = () => {
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
    setEditingItem(null);
    setTestInput('');
  };

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/incidents/system-mappings`);
      const data = await res.json();
      if (data.success) setMappings(data.data || []);
      else setError(data.details || 'Failed to fetch system mappings');
    } catch (e) {
      setError('Error connecting to server: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentGroups = async () => {
    try {
      setLoadingGroups(true);
      const res = await fetch(`${API_BASE}/incidents/assignment-groups`);
      const data = await res.json();
      if (data.success) {
        setAssignmentGroups(data.data || []);
      }
    } catch (e) {
      console.warn('Could not fetch assignment groups:', e.message);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchAssignmentGroups();
  }, []);

  // ================== PATTERN MANAGEMENT ==================

  const addPattern = () => {
    const trimmed = newPattern.value.trim();

    if (!trimmed) {
      alert('Please enter a pattern value');
      return;
    }

    if (newPattern.type === 'regex') {
      try {
        // Validate regex
        new RegExp(trimmed, 'i');
      } catch (e) {
        alert(`Invalid regex pattern: ${e.message}`);
        return;
      }
    }

    if (newPattern.type === 'exact' && !/^[a-z0-9_-]+$/i.test(trimmed)) {
      alert('Exact match can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    const isDuplicate = form.grafana_names.some(
      (p) => p.value.toLowerCase() === trimmed.toLowerCase() && p.type === newPattern.type
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
          value: newPattern.type === 'exact' ? trimmed.toLowerCase() : trimmed,
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

    const normalizedInput = input.toLowerCase();
    const normalizedPattern = pattern.value.toLowerCase();

    switch (pattern.type) {
      case 'exact':
        return normalizedInput === normalizedPattern;
      case 'contains':
        return normalizedInput.includes(normalizedPattern);
      case 'regex':
        try {
          const regex = new RegExp(normalizedPattern, 'i');
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

  // ================== CUSTOM FIELDS MANAGEMENT ==================

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

  // ================== CRUD OPERATIONS ==================

  const save = async (e) => {
    e.preventDefault();

    if (form.grafana_names.length === 0) {
      setError('Please add at least one Grafana application pattern');
      return;
    }

    try {
      const dataToSave = {
        ...form,
        ...customFields,
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
        await fetchMappings();
        reset();
        setShowForm(false);
        setError(null);
      } else {
        setError(data.details || 'Failed to save mapping');
      }
    } catch (e2) {
      setError('Error saving mapping: ' + e2.message);
    }
  };

  const startEdit = (m) => {
    const patterns = (m.grafana_names || []).map((item) => {
      if (typeof item === 'string') {
        return { value: item, type: 'exact' };
      }
      return item;
    });

    const formData = {
      grafana_names: patterns,
      service_offering: m.service_offering || '',
      business_service: m.business_service || '',
      u_network: m.u_network || '',
      u_impact_technology: m.u_impact_technology || '',
      assignment_group: m.assignment_group || '',
      u_system_failure: Boolean(m.u_system_failure),
    };

    setForm(formData);

    const custom = {};
    Object.keys(m).forEach((key) => {
      if (!excludeFromCustom.includes(key)) {
        custom[key] = m[key] || '';
      }
    });

    setCustomFields(custom);
    setEditingItem(m);
    setShowForm(true);

    setTimeout(() => {
      document.getElementById('mapping-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  };

  const del = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    try {
      const res = await fetch(`${API_BASE}/incidents/system-mappings/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchMappings();
        setError(null);
      } else {
        setError(data.details || 'Failed to delete mapping');
      }
    } catch (e) {
      setError('Error deleting mapping: ' + e.message);
    }
  };

  // ================== RENDER HELPERS ==================

  const formatPatternDisplay = (pattern) => {
    if (typeof pattern === 'string') {
      return { value: pattern, type: 'exact' };
    }
    return pattern;
  };

  const matchResult = testAllPatterns();

  const renderPatternChip = (pattern, idx) => {
    const p = formatPatternDisplay(pattern);
    const colorsForType = PATTERN_COLORS[p.type] || PATTERN_COLORS.exact;

    return (
      <span
        key={idx}
        style={{
          background: `linear-gradient(135deg, ${colorsForType.softBg}, ${colorsForType.strongBg})`,
          color: colorsForType.main,
          padding: '6px 12px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          border: `2px solid ${colorsForType.border}`,
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

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          background: neutralSoftGradient,
          borderRadius: 12,
          border: `2px solid ${colors.border.primary}`,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <RefreshCw
            size={32}
            style={{
              animation: 'spin 1s linear infinite',
              color: colors.brand.primary,
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
            Loading your mappings...
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
      {error && (
        <div
          style={{
            background: errorGradient,
            border: `2px solid ${colors.semantic.error}`,
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <AlertTriangle size={20} color={colors.semantic.error} />
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontWeight: 600,
                color: colors.semantic.error,
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
              {error}
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: colors.semantic.error,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
          padding: '0 8px',
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              color: colors.text.primary,    // always readable
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Settings size={28} color={colors.text.primary} />
            System Mappings
          </h2>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => {
              reset();
              setShowForm(!showForm);
            }}
            style={{
              background: showForm
                ? `linear-gradient(135deg, ${colors.brand.yellow} 0%, ${colors.semantic.warning} 100%)`
                : `linear-gradient(135deg, ${colors.brand.primary} 0%, ${colors.brand.primaryHover} 100%)`,
              color: colors.text.inverse,
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: `0 4px 12px ${withAlpha(colors.brand.primary, '40')}`,
              transition: 'all 0.2s ease',
            }}
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cancel' : 'Create New Mapping'}
          </button>

          <button
            onClick={fetchMappings}
            style={{
              background: colors.bg.secondary,
              color: colors.text.secondary,
              border: `2px solid ${colors.border.primary}`,
              borderRadius: 12,
              padding: '12px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s ease',
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
          id="mapping-form"
          style={{
            background: colors.bg.secondary,
            borderRadius: 16,
            padding: 32,
            marginBottom: 32,
            boxShadow: colors.shadow.xl,
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
              background: headerBarGradient,
              borderRadius: '16px 16px 0 0',
            }}
          />
          <div style={{ marginTop: 8 }}>
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
              {editingItem ? 'Update Mapping' : 'Create New Mapping'}
            </h3>
            <p
              style={{
                margin: 0,
                color: colors.text.secondary,
                fontSize: 16,
                marginBottom: 32,
              }}
            >
              {editingItem
                ? 'Update how these applications create incidents'
                : 'Configure how alerts from Grafana applications create ServiceNow incidents.'}
            </p>

            <form
              onSubmit={save}
              style={{ display: 'flex', flexDirection: 'column', gap: 32 }}
            >
              {/* Grafana Application Patterns */}
              <div
                style={{
                  background: infoGradient,
                  padding: 28,
                  borderRadius: 12,
                  border: `2px solid ${colors.semantic.info}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 20,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <h4
                      style={{
                        margin: '0 0 8px 0',
                        fontSize: 20,
                        fontWeight: 700,
                        color: colors.semantic.infoText,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                      }}
                    >
                      <Target size={24} />
                      Grafana Application Patterns
                    </h4>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        color: colors.semantic.infoText,
                        lineHeight: 1.5,
                      }}
                    >
                      Define which Grafana applications should use this mapping using exact names,
                      wildcards, or regex patterns.
                    </p>
                  </div>
                </div>

                {/* Pattern Input */}
                <div
                  style={{
                    background: colors.bg.secondary,
                    padding: 20,
                    borderRadius: 12,
                    border: `2px solid ${colors.border.primary}`,
                    marginBottom: 20,
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
                          fontWeight: 600,
                          color: colors.semantic.infoText,
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
                          padding: '10px',
                          border: `2px solid ${colors.border.secondary}`,
                          borderRadius: 6,
                          fontSize: 14,
                          fontWeight: 600,
                          background: colors.bg.secondary,
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
                          fontWeight: 600,
                          color: colors.semantic.infoText,
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
                          padding: '10px 14px',
                          border: `2px solid ${colors.border.secondary}`,
                          borderRadius: 6,
                          fontSize: 14,
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
                        background: `linear-gradient(135deg, ${colors.semantic.info} 0%, ${colors.border.focus} 100%)`,
                        color: colors.text.inverse,
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 20px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        whiteSpace: 'nowrap',
                        boxShadow: `0 2px 8px ${withAlpha(colors.semantic.info, '50')}`,
                      }}
                    >
                      <Plus size={16} />
                      Add Pattern
                    </button>
                  </div>
                </div>

                {/* Pattern List */}
                {form.grafana_names.length > 0 ? (
                  <div
                    style={{
                      background: colors.bg.secondary,
                      padding: 20,
                      borderRadius: 12,
                      border: `2px solid ${colors.border.primary}`,
                      marginBottom: 20,
                    }}
                  >
                    <h5
                      style={{
                        margin: '0 0 16px 0',
                        fontSize: 15,
                        fontWeight: 600,
                        color: colors.semantic.infoText,
                      }}
                    >
                      Active Patterns ({form.grafana_names.length})
                    </h5>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      {form.grafana_names.map((pattern, index) => {
                        const colorsForType =
                          PATTERN_COLORS[pattern.type] || PATTERN_COLORS.exact;

                        return (
                          <div
                            key={index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              background: colors.bg.tertiary,
                              borderRadius: 8,
                              border: `2px solid ${colorsForType.softBg}`,
                              borderLeft: `4px solid ${colorsForType.main}`,
                            }}
                          >
                            <span style={{ fontSize: 18 }}>
                              {PATTERN_TYPES[pattern.type].icon}
                            </span>

                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: colorsForType.main,
                                  marginBottom: 2,
                                }}
                              >
                                {PATTERN_TYPES[pattern.type].label}
                              </div>
                              <div
                                style={{
                                  fontSize: 14,
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
                                  background: colors.semantic.successBg,
                                  color: colors.semantic.successText,
                                  padding: '4px 10px',
                                  borderRadius: 12,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Check size={12} />
                                MATCH
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => removePattern(index)}
                              style={{
                                background: `linear-gradient(135deg, ${colors.semantic.error} 0%, ${colors.semantic.errorText} 100%)`,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 6,
                                padding: 6,
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
                      padding: 32,
                      borderRadius: 12,
                      border: `2px dashed ${colors.border.secondary}`,
                      textAlign: 'center',
                      color: colors.semantic.infoText,
                      marginBottom: 20,
                    }}
                  >
                    <Search
                      size={32}
                      color={colors.semantic.info}
                      style={{ marginBottom: 12, opacity: 0.7 }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      No patterns added yet. Add at least one pattern to continue.
                    </p>
                  </div>
                )}

                {/* Pattern Tester */}
                <div
                  style={{
                    background: warningGradient,
                    padding: 20,
                    borderRadius: 12,
                    border: `2px solid ${colors.semantic.warning}`,
                  }}
                >
                  <h5
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: 15,
                      fontWeight: 600,
                      color: colors.semantic.warningText,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Zap size={18} />
                    בדיקה האם מה שהגדרתם עובד :)
                  </h5>

                  <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
                    <div style={{ flex: 1 }}>
                      <label
                        style={{
                          display: 'block',
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.semantic.warningText,
                          marginBottom: 6,
                        }}
                      >
                      </label>
                      <input
                        type="text"
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="e.g. mongodb-prod, db-cache-01"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: `2px solid ${colors.brand.yellowBorder}`,
                          borderRadius: 6,
                          fontSize: 14,
                          background: colors.bg.secondary,
                          color: colors.text.primary,
                        }}
                      />
                    </div>

                    {matchResult !== null && (
                      <div
                        style={{
                          background: matchResult
                            ? colors.semantic.successBg
                            : colors.semantic.errorBg,
                          color: matchResult
                            ? colors.semantic.successText
                            : colors.semantic.errorText,
                          padding: '10px 20px',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {matchResult ? (
                          <>
                            <Check size={18} />
                            Matches {matchResult.length} pattern
                            {matchResult.length > 1 ? 's' : ''}
                          </>
                        ) : (
                          <>
                            <X size={18} />
                            No Match
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {matchResult && matchResult.length > 0 && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: colors.bg.secondary,
                        borderRadius: 6,
                        border: `2px solid ${colors.semantic.success}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.semantic.successText,
                          marginBottom: 6,
                        }}
                      >
                        Matching Patterns:
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
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
                  background: successGradient,
                  padding: 24,
                  borderRadius: 12,
                  border: `2px solid ${colors.semantic.success}`,
                }}
              >
                <h4
                  style={{
                    margin: '0 0 12px 0',
                    fontSize: 18,
                    fontWeight: 600,
                    color: colors.semantic.successText,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <CheckCircle size={18} />
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
                        fontWeight: 600,
                        color: colors.semantic.successText,
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
                        padding: '10px 14px',
                        borderRadius: 6,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        border: `2px solid ${colors.border.secondary}`,
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
                        fontWeight: 600,
                        color: colors.semantic.successText,
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
                        padding: '10px 14px',
                        borderRadius: 6,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        border: `2px solid ${colors.border.secondary}`,
                        color: colors.text.primary,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.semantic.successText,
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
                        padding: '10px 14px',
                        borderRadius: 6,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        border: `2px solid ${colors.border.secondary}`,
                        color: colors.text.primary,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.semantic.successText,
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
                        padding: '10px 14px',
                        borderRadius: 6,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        border: `2px solid ${colors.border.secondary}`,
                        color: colors.text.primary,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.semantic.successText,
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
                        padding: '10px 14px',
                        borderRadius: 6,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        border: `2px solid ${colors.border.secondary}`,
                        color: colors.text.primary,
                      }}
                    />
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
                        checked={form.u_system_failure}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            u_system_failure: e.target.checked,
                          }))
                        }
                        style={{
                          width: 18,
                          height: 18,
                          accentColor: colors.semantic.success,
                        }}
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
                      Creates outage automatically.
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Fields Section */}
              <div
                style={{
                  background: `linear-gradient(135deg, ${colors.brand.purpleLight} 0%, ${withAlpha(
                    colors.brand.purple,
                    '10'
                  )} 100%)`,
                  padding: 24,
                  borderRadius: 12,
                  border: `2px solid ${colors.brand.purple}`,
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
                      color: colors.brand.purpleDark,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    ⚙️ Custom Fields ({Object.keys(customFields).length})
                  </h4>
                  <button
                    type="button"
                    onClick={addCustomField}
                    style={{
                      background: `linear-gradient(135deg, ${colors.brand.purple} 0%, ${colors.brand.purpleDark} 100%)`,
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
                    <PlusCircle size={16} />
                    Add Field
                  </button>
                </div>

                {Object.keys(customFields).length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px',
                      color: colors.brand.purpleDark,
                      fontSize: 14,
                    }}
                  >
                    No custom fields yet. Click "Add Field" to create service-specific fields like
                    u_eck_name or ORA_error.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}
                  >
                    {Object.entries(customFields).map(([fieldName, value]) => (
                      <div
                        key={fieldName}
                        style={{
                          background: colors.bg.secondary,
                          padding: 16,
                          borderRadius: 8,
                          border: `2px solid ${colors.brand.purpleLight}`,
                          display: 'grid',
                          gridTemplateColumns: '200px 1fr 40px',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: colors.brand.purpleDark,
                              marginBottom: 4,
                              fontFamily: 'monospace',
                            }}
                          >
                            {fieldName}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: colors.text.secondary,
                            }}
                          >
                            ServiceNow field
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
                            fontSize: 14,
                            background: colors.bg.secondary,
                            border: `1px solid ${colors.brand.purpleLight}`,
                            color: colors.text.primary,
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => removeCustomField(fieldName)}
                          style={{
                            background: 'transparent',
                            color: colors.brand.purpleDark,
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
                    border: `2px solid ${colors.border.primary}`,
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
                  disabled={form.grafana_names.length === 0}
                  style={{
                    background:
                      form.grafana_names.length > 0
                        ? `linear-gradient(135deg, ${colors.semantic.success} 0%, ${colors.semantic.successText} 100%)`
                        : colors.bg.tertiary,
                    color:
                      form.grafana_names.length > 0
                        ? colors.text.inverse
                        : colors.text.secondary,
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 32px',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: form.grafana_names.length > 0 ? 'pointer' : 'not-allowed',
                    boxShadow:
                      form.grafana_names.length > 0
                        ? `0 4px 12px ${withAlpha(colors.semantic.success, '50')}`
                        : 'none',
                  }}
                >
                  {editingItem ? '✅ Update Mapping' : '🚀 Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIST / EMPTY STATE */}
      {mappings.length === 0 ? (
        <div
          style={{
            background: neutralSoftGradient,
            border: `3px dashed ${colors.border.primary}`,
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h3
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: colors.text.primary,
              marginBottom: 12,
            }}
          >
            No Mappings Yet
          </h3>
          <p
            style={{
              fontSize: 16,
              color: colors.text.secondary,
              marginBottom: 24,
              maxWidth: 500,
              margin: '0 auto 24px',
            }}
          >
            Create your first system mapping to configure how Grafana applications create ServiceNow
            incidents.
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
              Your Mappings ({mappings.length})
            </h3>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {mappings.map((m) => {
              const customFieldsInMapping = Object.keys(m).filter(
                (k) => !excludeFromCustom.includes(k)
              );

              return (
                <div
                  key={m._id}
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
                      background: headerBarGradient,
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
                      <h4
                        style={{
                          margin: '0 0 12px 0',
                          fontSize: 20,
                          fontWeight: 700,
                          color: colors.text.primary,
                        }}
                      >
                        {m.service_offering}
                      </h4>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        {(m.grafana_names || []).map((pattern, idx) =>
                          renderPatternChip(pattern, idx)
                        )}

                        {m.u_system_failure && (
                          <span
                            style={{
                              background: colors.semantic.errorBg,
                              color: colors.semantic.errorText,
                              padding: '6px 12px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              border: `2px solid ${colors.semantic.error}`,
                            }}
                          >
                            SYSTEM FAILURE
                          </span>
                        )}
                        {customFieldsInMapping.length > 0 && (
                          <span
                            style={{
                              background: colors.brand.purpleLight,
                              color: colors.brand.purpleDark,
                              padding: '6px 12px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              border: `2px solid ${colors.brand.purple}`,
                            }}
                          >
                            {customFieldsInMapping.length} Custom Field
                            {customFieldsInMapping.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => startEdit(m)}
                        style={{
                          background: `linear-gradient(135deg, ${colors.brand.primary} 0%, ${colors.brand.primaryHover} 100%)`,
                          color: colors.text.inverse,
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => del(m._id)}
                        style={{
                          background: `linear-gradient(135deg, ${colors.semantic.error} 0%, ${colors.semantic.errorText} 100%)`,
                          color: colors.text.inverse,
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Base Required Fields */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 16,
                      marginBottom: customFieldsInMapping.length > 0 ? 16 : 0,
                    }}
                  >
                    <div
                      style={{
                        background: colors.bg.tertiary,
                        padding: 16,
                        borderRadius: 8,
                        border: `1px solid ${colors.border.primary}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.text.secondary,
                          marginBottom: 4,
                        }}
                      >
                        Assignment Group
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: colors.text.primary,
                        }}
                      >
                        {assignmentGroups.find((g) => g.value === m.assignment_group)?.label ||
                          m.assignment_group}
                      </div>
                    </div>

                    <div
                      style={{
                        background: colors.bg.tertiary,
                        padding: 16,
                        borderRadius: 8,
                        border: `1px solid ${colors.border.primary}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.text.secondary,
                          marginBottom: 4,
                        }}
                      >
                        Business Service
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: colors.text.primary,
                        }}
                      >
                        {m.business_service}
                      </div>
                    </div>

                    <div
                      style={{
                        background: colors.bg.tertiary,
                        padding: 16,
                        borderRadius: 8,
                        border: `1px solid ${colors.border.primary}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.text.secondary,
                          marginBottom: 4,
                        }}
                      >
                        Network
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: colors.text.primary,
                        }}
                      >
                        {m.u_network}
                      </div>
                    </div>

                    <div
                      style={{
                        background: colors.bg.tertiary,
                        padding: 16,
                        borderRadius: 8,
                        border: `1px solid ${colors.border.primary}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.text.secondary,
                          marginBottom: 4,
                        }}
                      >
                        Impact Technology
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: colors.text.primary,
                        }}
                      >
                        {m.u_impact_technology}
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields Display */}
                  {customFieldsInMapping.length > 0 && (
                    <div
                      style={{
                        padding: 16,
                        background: `linear-gradient(135deg, ${colors.brand.purpleLight} 0%, ${withAlpha(
                          colors.brand.purple,
                          '10'
                        )} 100%)`,
                        borderRadius: 8,
                        border: `2px solid ${colors.brand.purpleLight}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.brand.purpleDark,
                          marginBottom: 12,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        ⚙️ Custom Fields:
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: 12,
                        }}
                      >
                        {customFieldsInMapping.map((fieldName) => (
                          <div
                            key={fieldName}
                            style={{
                              background: colors.bg.secondary,
                              padding: 12,
                              borderRadius: 6,
                              border: `1px solid ${colors.brand.purpleLight}`,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: colors.brand.purpleDark,
                                marginBottom: 4,
                                fontFamily: 'monospace',
                              }}
                            >
                              {fieldName}
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                color: colors.text.primary,
                                fontWeight: 500,
                              }}
                            >
                              {m[fieldName] || (
                                <span style={{ color: colors.text.tertiary }}>—</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
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

export default IncidentMappings;
