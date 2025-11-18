import { useEffect, useState } from 'react';
import { Settings, Plus, Edit, Trash2, RefreshCw, CheckCircle, AlertTriangle, X, PlusCircle, MinusCircle, Target, Zap, Search, Check } from 'lucide-react';
import { API_BASE } from '../utils/constants';

const PATTERN_TYPES = {
  exact: { 
    label: 'Exact Match', 
    icon: '🎯', 
    color: '#3b82f6',
    description: 'Matches exactly this application name',
    example: 'mongo',
    placeholder: 'e.g., mongo, elasticsearch'
  },
  contains: { 
    label: 'Contains', 
    icon: '🔍', 
    color: '#8b5cf6',
    description: 'Matches any application containing this text',
    example: 'db (matches: mongodb, cassandra-db, db-prod)',
    placeholder: 'e.g., db, prod, cache'
  },
  regex: { 
    label: 'Regex Pattern', 
    icon: '⚡', 
    color: '#f59e0b',
    description: 'Matches applications using regular expressions',
    example: '^db-.*$ (matches: db-prod, db-test)',
    placeholder: 'e.g., ^mongo.*, .*-prod$, db-[0-9]+'
  }
};

const IncidentMappings = () => {
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
    'u_system_failure'
  ];

  const excludeFromCustom = [
    '_id',
    'grafana_names',
    'created_at',
    'updated_at',
    ...baseMandatoryFields
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

    // Validate regex if type is regex
    if (newPattern.type === 'regex') {
      try {
        new RegExp(trimmed, 'i');
      } catch (e) {
        alert(`Invalid regex pattern: ${e.message}`);
        return;
      }
    }

    // Validate exact match format
    if (newPattern.type === 'exact' && !/^[a-z0-9_-]+$/i.test(trimmed)) {
      alert('Exact match can only contain lowercase letters, numbers, hyphens, and underscores');
      return;
    }

    // Check for duplicates
    const isDuplicate = form.grafana_names.some(p => 
      p.value.toLowerCase() === trimmed.toLowerCase() && p.type === newPattern.type
    );
    
    if (isDuplicate) {
      alert('This pattern already exists');
      return;
    }

    setForm(prev => ({
      ...prev,
      grafana_names: [...prev.grafana_names, {
        value: newPattern.type === 'exact' ? trimmed.toLowerCase() : trimmed,
        type: newPattern.type
      }]
    }));
    setNewPattern({ value: '', type: 'exact' });
  };

  const removePattern = (index) => {
    setForm(prev => ({
      ...prev,
      grafana_names: prev.grafana_names.filter((_, i) => i !== index)
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
    
    const matches = form.grafana_names.filter(p => testPattern(p, testInput));
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

    setCustomFields(prev => ({
      ...prev,
      [sanitized]: ''
    }));
  };

  const removeCustomField = (fieldName) => {
    setCustomFields(prev => {
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  };

  const updateCustomField = (fieldName, value) => {
    setCustomFields(prev => ({
      ...prev,
      [fieldName]: value
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
        ...customFields
      };

      const url = editingItem ? `${API_BASE}/system-mappings/${editingItem._id}` : `${API_BASE}/system-mappings`;
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
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
    } catch (e) {
      setError('Error saving mapping: ' + e.message);
    }
  };

  const startEdit = (m) => {
    // Convert old string format to pattern objects if needed
    const patterns = (m.grafana_names || []).map(item => {
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

    // Extract custom fields
    const custom = {};
    Object.keys(m).forEach(key => {
      if (!excludeFromCustom.includes(key)) {
        custom[key] = m[key] || '';
      }
    });

    setCustomFields(custom);
    setEditingItem(m);
    setShowForm(true);
    
    setTimeout(() => {
      document.getElementById('mapping-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const del = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    try {
      const res = await fetch(`${API_BASE}/system-mappings/${id}`, { method: 'DELETE' });
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

  // ================== RENDER ==================

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
        <div style={{textAlign: 'center'}}>
          <RefreshCw size={32} style={{animation: 'spin 1s linear infinite', color: '#3b82f6', marginBottom: 16}} />
          <div style={{fontSize: 18, color: '#475569', fontWeight: 500}}>Loading your mappings...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{maxWidth: '100%', margin: '0 auto'}}>
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
          <div style={{flex: 1}}>
            <div style={{fontWeight: 600, color: '#dc2626', marginBottom: 4}}>Error</div>
            <div style={{color: '#b91c1c', fontSize: 14}}>{error}</div>
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

      <div style={{
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 32,
        padding: '0 8px'
      }}>
        <div>
          <h2 style={{
            margin: 0, 
            fontSize: 28, 
            fontWeight: 700,
            background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <Settings size={28} />
            System Mappings
          </h2>
          <p style={{margin: '8px 0 0 40px', fontSize: 14, color: '#64748b'}}>
            Map Grafana applications to ServiceNow incident fields using exact match, contains, or regex patterns
          </p>
        </div>

        <div style={{display: 'flex', gap: 12}}>
          <button
            onClick={() => { reset(); setShowForm(!showForm); }}
            style={{
              background: showForm 
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {showForm ? <X size={18} /> : <Plus size={18} />}
            {showForm ? 'Cancel' : 'Create New Mapping'}
          </button>
          
          <button 
            onClick={fetchMappings}
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
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {showForm && (
        <div 
          id="mapping-form"
          style={{
            background: 'white',
            borderRadius: 16,
            padding: 32,
            marginBottom: 32,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
            borderRadius: '16px 16px 0 0'
          }} />
          
          <div style={{marginTop: 8}}>
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
              {editingItem ? 'Update Mapping' : 'Create New Mapping'}
            </h3>
            <p style={{
              margin: 0, 
              color: '#64748b', 
              fontSize: 16,
              marginBottom: 32
            }}>
              {editingItem 
                ? 'Update how these applications create incidents' 
                : 'Configure how alerts from Grafana applications create ServiceNow incidents'
              }
            </p>

            <form onSubmit={save} style={{display: 'flex', flexDirection: 'column', gap: 32}}>
              {/* Grafana Application Patterns */}
              <div style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                padding: 28,
                borderRadius: 12,
                border: '2px solid #0ea5e9'
              }}>
                {/* Header with Help Toggle */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 20
                }}>
                  <div style={{flex: 1}}>
                    <h4 style={{
                      margin: '0 0 8px 0',
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#0c4a6e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}>
                      <Target size={24} />
                      Grafana Application Patterns
                    </h4>
                    <p style={{margin: 0, fontSize: 14, color: '#0369a1', lineHeight: 1.5}}>
                      Define which Grafana applications should use this mapping using exact names, wildcards, or regex patterns.
                    </p>
                  </div>

              
                </div>

                {/* Pattern Input */}
                <div style={{
                  background: 'white',
                  padding: 20,
                  borderRadius: 12,
                  border: '2px solid #bae6fd',
                  marginBottom: 20
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '140px 1fr auto',
                    gap: 12,
                    alignItems: 'end'
                  }}>
                    {/* Pattern Type Selector */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#0369a1',
                        marginBottom: 6
                      }}>
                        Pattern Type
                      </label>
                      <select
                        value={newPattern.type}
                        onChange={(e) => setNewPattern(prev => ({ ...prev, type: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px',
                          border: '2px solid #bae6fd',
                          borderRadius: 6,
                          fontSize: 14,
                          fontWeight: 600,
                          background: 'white',
                          cursor: 'pointer',
                          color: PATTERN_TYPES[newPattern.type].color
                        }}
                      >
                        {Object.entries(PATTERN_TYPES).map(([type, info]) => (
                          <option key={type} value={type}>
                            {info.icon} {info.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pattern Value Input */}
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#0369a1',
                        marginBottom: 6
                      }}>
                        Pattern Value
                      </label>
                      <input
                        type="text"
                        value={newPattern.value}
                        onChange={(e) => setNewPattern(prev => ({ ...prev, value: e.target.value }))}
                        onKeyPress={handlePatternKeyPress}
                        placeholder={PATTERN_TYPES[newPattern.type].placeholder}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '2px solid #bae6fd',
                          borderRadius: 6,
                          fontSize: 14,
                          background: 'white',
                          fontFamily: newPattern.type === 'regex' ? 'monospace' : 'inherit'
                        }}
                      />
                    </div>

                    {/* Add Button */}
                    <button
                      type="button"
                      onClick={addPattern}
                      style={{
                        background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
                        color: 'white',
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
                        boxShadow: '0 2px 8px rgba(14, 165, 233, 0.3)'
                      }}
                    >
                      <Plus size={16} />
                      Add Pattern
                    </button>
                  </div>
                </div>

                {/* Pattern List */}
                {form.grafana_names.length > 0 ? (
                  <div style={{
                    background: 'white',
                    padding: 20,
                    borderRadius: 12,
                    border: '2px solid #bae6fd',
                    marginBottom: 20
                  }}>
                    <h5 style={{
                      margin: '0 0 16px 0',
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#0c4a6e'
                    }}>
                      Active Patterns ({form.grafana_names.length})
                    </h5>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}>
                      {form.grafana_names.map((pattern, index) => (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: 12,
                            background: '#f8fafc',
                            borderRadius: 8,
                            border: `2px solid ${PATTERN_TYPES[pattern.type].color}20`,
                            borderLeft: `4px solid ${PATTERN_TYPES[pattern.type].color}`
                          }}
                        >
                          <span style={{fontSize: 18}}>
                            {PATTERN_TYPES[pattern.type].icon}
                          </span>

                          <div style={{flex: 1}}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: PATTERN_TYPES[pattern.type].color,
                              marginBottom: 2
                            }}>
                              {PATTERN_TYPES[pattern.type].label}
                            </div>
                            <div style={{
                              fontSize: 14,
                              fontFamily: pattern.type === 'regex' ? 'monospace' : 'inherit',
                              color: '#1e293b',
                              fontWeight: 500
                            }}>
                              {pattern.value}
                            </div>
                          </div>

                          {testInput && testPattern(pattern, testInput) && (
                            <div style={{
                              background: '#dcfce7',
                              color: '#166534',
                              padding: '4px 10px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4
                            }}>
                              <Check size={12} />
                              MATCH
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => removePattern(index)}
                            style={{
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: 6,
                              padding: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'white',
                    padding: 32,
                    borderRadius: 12,
                    border: '2px dashed #bae6fd',
                    textAlign: 'center',
                    color: '#0369a1',
                    marginBottom: 20
                  }}>
                    <Search size={32} color="#0ea5e9" style={{marginBottom: 12, opacity: 0.5}} />
                    <p style={{margin: 0, fontSize: 14, fontWeight: 500}}>
                      No patterns added yet. Add at least one pattern to continue.
                    </p>
                  </div>
                )}

                {/* Pattern Tester */}
                <div style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  padding: 20,
                  borderRadius: 12,
                  border: '2px solid #f59e0b'
                }}>
                  <h5 style={{
                    margin: '0 0 12px 0',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <Zap size={18} />
                    בדיקה האם מה שהגדרתם עובד :)
                  </h5>

                  <div style={{display: 'flex', gap: 12, alignItems: 'end'}}>
                    <div style={{flex: 1}}>
                      <label style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#92400e',
                        marginBottom: 6
                      }}>
                        Test Application Name
                      </label>
                      <input
                        type="text"
                        value={testInput}
                        onChange={(e) => setTestInput(e.target.value)}
                        placeholder="e.g., mongodb-prod, db-cache-01"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '2px solid #fcd34d',
                          borderRadius: 6,
                          fontSize: 14,
                          background: 'white'
                        }}
                      />
                    </div>

                    {matchResult !== null && (
                      <div style={{
                        background: matchResult ? '#dcfce7' : '#fee2e2',
                        color: matchResult ? '#166534' : '#dc2626',
                        padding: '10px 20px',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        whiteSpace: 'nowrap'
                      }}>
                        {matchResult ? (
                          <>
                            <Check size={18} />
                            Matches {matchResult.length} pattern{matchResult.length > 1 ? 's' : ''}
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
                    <div style={{
                      marginTop: 12,
                      padding: 12,
                      background: 'white',
                      borderRadius: 6,
                      border: '2px solid #a3e635'
                    }}>
                      <div style={{fontSize: 12, fontWeight: 600, color: '#3f6212', marginBottom: 8}}>
                        Matching patterns:
                      </div>
                      {matchResult.map((pattern, i) => (
                        <div key={i} style={{
                          fontSize: 13,
                          color: '#4d7c0f',
                          fontFamily: pattern.type === 'regex' ? 'monospace' : 'inherit',
                          marginBottom: 4
                        }}>
                          {PATTERN_TYPES[pattern.type].icon} <strong>{pattern.type}:</strong> {pattern.value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Service Offering */}
              <div style={{
                background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                padding: 24,
                borderRadius: 12,
                border: '2px solid #f59e0b'
              }}>
                <h4 style={{
                  margin: '0 0 16px 0', 
                  fontSize: 18, 
                  fontWeight: 600,
                  color: '#92400e'
                }}>
                  🏢 Service Offering
                </h4>
                <input 
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #fcd34d',
                    borderRadius: 8,
                    fontSize: 16,
                    background: 'white',
                    color: '#92400e'
                  }}
                  value={form.service_offering} 
                  onChange={(e) => setForm(p => ({...p, service_offering: e.target.value}))}
                  required 
                  placeholder="e.g., Elasticsearch - ECK"
                />
              </div>

              {/* Required Fields */}
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                padding: 24,
                borderRadius: 12,
                border: '2px solid #22c55e'
              }}>
                <h4 style={{
                  margin: '0 0 20px 0', 
                  fontSize: 18, 
                  fontWeight: 600,
                  color: '#166534',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8
                }}>
                  <CheckCircle size={20} />
                  Required Fields
                </h4>
                
                <div style={{
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                  gap: 20
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#166534',
                      marginBottom: 8
                    }}>
                      Business Service *
                    </label>
                    <input 
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '2px solid #bbf7d0',
                        borderRadius: 6,
                        fontSize: 14,
                        background: 'white'
                      }}
                      value={form.business_service} 
                      onChange={(e) => setForm(p => ({...p, business_service: e.target.value}))} 
                      required 
                      placeholder="e.g., Data Repository" 
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#166534',
                      marginBottom: 8
                    }}>
                      Network *
                    </label>
                    <input 
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '2px solid #bbf7d0',
                        borderRadius: 6,
                        fontSize: 14,
                        background: 'white'
                      }}
                      value={form.u_network} 
                      onChange={(e) => setForm(p => ({...p, u_network: e.target.value}))} 
                      required 
                      placeholder="e.g., main" 
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#166534',
                      marginBottom: 8
                    }}>
                      Impact Technology *
                    </label>
                    <input 
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '2px solid #bbf7d0',
                        borderRadius: 6,
                        fontSize: 14,
                        background: 'white'
                      }}
                      value={form.u_impact_technology} 
                      onChange={(e) => setForm(p => ({...p, u_impact_technology: e.target.value}))} 
                      required 
                      placeholder="e.g., Resilience Sheet" 
                    />
                  </div>
                  
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#166534',
                      marginBottom: 8
                    }}>
                      Assignment Group *
                    </label>
                    {loadingGroups ? (
                      <div style={{padding: '10px', color: '#64748b', fontSize: 14}}>
                        Loading groups...
                      </div>
                    ) : assignmentGroups.length > 0 ? (
                      <select
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '2px solid #bbf7d0',
                          borderRadius: 6,
                          fontSize: 14,
                          background: 'white',
                          cursor: 'pointer'
                        }}
                        value={form.assignment_group}
                        onChange={(e) => setForm(p => ({...p, assignment_group: e.target.value}))}
                        required
                      >
                        <option value="">Select a team...</option>
                        {assignmentGroups.map(group => (
                          <option key={group.value} value={group.value}>
                            {group.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input 
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: '2px solid #bbf7d0',
                          borderRadius: 6,
                          fontSize: 14,
                          background: 'white'
                        }}
                        value={form.assignment_group} 
                        onChange={(e) => setForm(p => ({...p, assignment_group: e.target.value}))} 
                        required 
                        placeholder="e.g., Repository Team" 
                      />
                    )}
                  </div>

                  <div>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#166534',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={form.u_system_failure}
                        onChange={(e) => setForm(p => ({...p, u_system_failure: e.target.checked}))}
                        style={{
                          width: 18,
                          height: 18,
                          accentColor: '#22c55e'
                        }}
                      />
                      System Failure
                    </label>
                    <p style={{margin: '4px 0 0 30px', fontSize: 12, color: '#15803d'}}>
                      Creates outage automatically
                    </p>
                  </div>
                </div>
              </div>

              {/* Custom Fields Section */}
              <div style={{
                background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                padding: 24,
                borderRadius: 12,
                border: '2px solid #a855f7'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20
                }}>
                  <h4 style={{
                    margin: 0, 
                    fontSize: 18, 
                    fontWeight: 600,
                    color: '#6b21a8',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8
                  }}>
                    ⚙️ Custom Fields ({Object.keys(customFields).length})
                  </h4>
                  <button
                    type="button"
                    onClick={addCustomField}
                    style={{
                      background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
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
                    <PlusCircle size={16} />
                    Add Field
                  </button>
                </div>

                {Object.keys(customFields).length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '32px',
                    color: '#9333ea',
                    fontSize: 14
                  }}>
                    No custom fields yet. Click "Add Field" to create service-specific fields like u_eck_name or ORA_error.
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16
                  }}>
                    {Object.entries(customFields).map(([fieldName, value]) => (
                      <div 
                        key={fieldName}
                        style={{
                          background: 'white',
                          padding: 16,
                          borderRadius: 8,
                          border: '2px solid #e9d5ff',
                          display: 'grid',
                          gridTemplateColumns: '200px 1fr 40px',
                          gap: 12,
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#9333ea',
                            marginBottom: 4
                          }}>
                            Field Name
                          </div>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#6b21a8',
                            fontFamily: 'monospace'
                          }}>
                            {fieldName}
                          </div>
                        </div>

                        <div>
                          <label style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#9333ea',
                            marginBottom: 4
                          }}>
                            Default Value
                          </label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => updateCustomField(fieldName, e.target.value)}
                            placeholder={`Default value for ${fieldName}`}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '2px solid #e9d5ff',
                              borderRadius: 6,
                              fontSize: 14,
                              background: 'white'
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeCustomField(fieldName)}
                          style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            padding: 8,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
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

              <div style={{
                display: 'flex', 
                gap: 16, 
                justifyContent: 'flex-end',
                paddingTop: 24,
                borderTop: '2px solid #f1f5f9'
              }}>
                <button 
                  type="button" 
                  onClick={() => { reset(); setShowForm(false); }}
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
                  disabled={form.grafana_names.length === 0}
                  style={{
                    background: form.grafana_names.length > 0 
                      ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                      : '#e5e7eb',
                    color: form.grafana_names.length > 0 ? 'white' : '#9ca3af',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 32px',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: form.grafana_names.length > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: form.grafana_names.length > 0 ? '0 4px 12px rgba(34, 197, 94, 0.3)' : 'none'
                  }}
                >
                  {editingItem ? '✅ Update Mapping' : '🚀 Create Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mappings.length === 0 ? (
        <div style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          border: '3px dashed #cbd5e1',
          borderRadius: 16,
          padding: 48,
          textAlign: 'center'
        }}>
          <div style={{fontSize: 48, marginBottom: 16}}>📋</div>
          <h3 style={{fontSize: 24, fontWeight: 700, color: '#475569', marginBottom: 12}}>
            No Mappings Yet
          </h3>
          <p style={{fontSize: 16, color: '#64748b', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px'}}>
            Create your first system mapping to configure how Grafana applications create ServiceNow incidents.
          </p>
        </div>
      ) : (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            padding: '0 8px'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: '#1e293b'
            }}>
              Your Mappings ({mappings.length})
            </h3>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
            {mappings.map((m) => {
              const customFieldsInMapping = Object.keys(m).filter(k => 
                !excludeFromCustom.includes(k)
              );
              
              return (
                <div 
                  key={m._id} 
                  style={{
                    background: 'white',
                    borderRadius: 16,
                    padding: 24,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
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
                    height: 4,
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)'
                  }} />

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 20,
                    marginTop: 8
                  }}>
                    <div style={{flex: 1}}>
                      <h4 style={{
                        margin: '0 0 12px 0',
                        fontSize: 20,
                        fontWeight: 700,
                        color: '#1e293b'
                      }}>
                        {m.service_offering}
                      </h4>
                      
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 8
                      }}>
                        {(m.grafana_names || []).map((pattern, idx) => {
                          const p = formatPatternDisplay(pattern);
                          return (
                            <span 
                              key={idx}
                              style={{
                                background: `linear-gradient(135deg, ${PATTERN_TYPES[p.type].color}15, ${PATTERN_TYPES[p.type].color}25)`,
                                color: PATTERN_TYPES[p.type].color,
                                padding: '6px 12px',
                                borderRadius: 12,
                                fontSize: 13,
                                fontWeight: 600,
                                border: `2px solid ${PATTERN_TYPES[p.type].color}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontFamily: p.type === 'regex' ? 'monospace' : 'inherit'
                              }}
                            >
                              <span>{PATTERN_TYPES[p.type].icon}</span>
                              <span>{p.value}</span>
                            </span>
                          );
                        })}
                        {m.u_system_failure && (
                          <span style={{
                            background: '#fecaca',
                            color: '#dc2626',
                            padding: '6px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            border: '2px solid #dc2626'
                          }}>
                            SYSTEM FAILURE
                          </span>
                        )}
                        {customFieldsInMapping.length > 0 && (
                          <span style={{
                            background: '#e9d5ff',
                            color: '#9333ea',
                            padding: '6px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            border: '2px solid #9333ea'
                          }}>
                            {customFieldsInMapping.length} Custom Field{customFieldsInMapping.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{display: 'flex', gap: 8}}>
                      <button 
                        onClick={() => startEdit(m)}
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button 
                        onClick={() => del(m._id)}
                        style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Base Required Fields */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: 16,
                    marginBottom: customFieldsInMapping.length > 0 ? 16 : 0
                  }}>
                    <div style={{
                      background: '#f8fafc',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4}}>
                        Assignment Group
                      </div>
                      <div style={{fontSize: 14, fontWeight: 600, color: '#1e293b'}}>
                        {assignmentGroups.find(g => g.value === m.assignment_group)?.label || m.assignment_group}
                      </div>
                    </div>

                    <div style={{
                      background: '#f8fafc',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4}}>
                        Business Service
                      </div>
                      <div style={{fontSize: 14, fontWeight: 600, color: '#1e293b'}}>
                        {m.business_service}
                      </div>
                    </div>

                    <div style={{
                      background: '#f8fafc',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4}}>
                        Network
                      </div>
                      <div style={{fontSize: 14, fontWeight: 600, color: '#1e293b'}}>
                        {m.u_network}
                      </div>
                    </div>

                    <div style={{
                      background: '#f8fafc',
                      padding: 16,
                      borderRadius: 8,
                      border: '1px solid #e2e8f0'
                    }}>
                      <div style={{fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4}}>
                        Impact Technology
                      </div>
                      <div style={{fontSize: 14, fontWeight: 600, color: '#1e293b'}}>
                        {m.u_impact_technology}
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields Display */}
                  {customFieldsInMapping.length > 0 && (
                    <div style={{
                      padding: 16,
                      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
                      borderRadius: 8,
                      border: '2px solid #e9d5ff'
                    }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#9333ea',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        ⚙️ Custom Fields:
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12
                      }}>
                        {customFieldsInMapping.map(fieldName => (
                          <div key={fieldName} style={{
                            background: 'white',
                            padding: 12,
                            borderRadius: 6,
                            border: '1px solid #e9d5ff'
                          }}>
                            <div style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#9333ea',
                              marginBottom: 4,
                              fontFamily: 'monospace'
                            }}>
                              {fieldName}
                            </div>
                            <div style={{fontSize: 14, color: '#6b21a8', fontWeight: 500}}>
                              {m[fieldName] || <span style={{color: '#cbd5e1'}}>—</span>}
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