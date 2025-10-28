import React, { useEffect, useState } from 'react';
import { 
  Target, Plus, Edit, Trash2, RefreshCw, CheckCircle, XCircle, Eye, Zap, 
  AlertTriangle, X, ToggleLeft, ToggleRight, Filter, ArrowDown, Trash
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/incidents';

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
      return mappings.find(m => String(m._id) === String(form.system_mapping_id)); 
    } catch { 
      return undefined; 
    }
  }, [mappings, form.system_mapping_id]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/incident-rules`);
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
      const res = await fetch(`${API_BASE}/system-mappings`);
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
      conditions: [...prev.conditions, {
        id: Date.now(),
        field: 'message',
        operator: 'contains',
        value: ''
      }]
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
      // Convert new format to backend format
      const legacyConditions = {};
      
      form.conditions.forEach(condition => {
        const { field, operator, value } = condition;
        if (!value || !value.toString().trim()) return;

        if (operator === 'contains') {
          if (!legacyConditions[`${field}_contains`]) {
            legacyConditions[`${field}_contains`] = [];
          }
          legacyConditions[`${field}_contains`].push(value.toString().trim());
        } else if (operator === 'equals') {
          legacyConditions[`${field}_exact`] = value.toString().trim();
        } else if (operator === 'regex') {
          legacyConditions[`${field}_regex`] = value.toString().trim();
        }
      });

      // Clean the incident_overrides - remove empty values
      const cleanOverrides = {};
          Object.entries(form.incident_overrides).forEach(([key, value]) => {
            if (key === 'u_system_failure') {
              // FIXED: Always send u_system_failure explicitly, whether true or false
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
        incident_overrides: Object.keys(cleanOverrides).length > 0 ? cleanOverrides : undefined,
        enabled: form.enabled
      };

      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      
      const url = editingItem ? `${API_BASE}/incident-rules/${editingItem._id}` : `${API_BASE}/incident-rules`;
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, { 
        method, 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      });
      const data = await res.json();
      
      console.log('Server response:', data);
      
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
      const res = await fetch(`${API_BASE}/incident-rules/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`${API_BASE}/incident-rules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
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
    // Convert legacy conditions to new format - avoid duplicates
    const newConditions = [];
    let conditionId = 1;

    // Create a Set to track what we've already added to avoid duplicates
    const addedConditions = new Set();

    // Handle message conditions
    if (rule.conditions?.message_contains?.length) {
      rule.conditions.message_contains.forEach(value => {
        const key = `message-contains-${value}`;
        if (!addedConditions.has(key)) {
          newConditions.push({
            id: conditionId++,
            field: 'message',
            operator: 'contains',
            value
          });
          addedConditions.add(key);
        }
      });
    }

    if (rule.conditions?.message_regex) {
      const key = `message-regex-${rule.conditions.message_regex}`;
      if (!addedConditions.has(key)) {
        newConditions.push({
          id: conditionId++,
          field: 'message',
          operator: 'regex',
          value: rule.conditions.message_regex
        });
        addedConditions.add(key);
      }
    }

    if (rule.conditions?.message_exact) {
      const key = `message-equals-${rule.conditions.message_exact}`;
      if (!addedConditions.has(key)) {
        newConditions.push({
          id: conditionId++,
          field: 'message',
          operator: 'equals',
          value: rule.conditions.message_exact
        });
        addedConditions.add(key);
      }
    }

    // Handle other field conditions
    Object.keys(CONDITION_FIELDS).forEach(field => {
      if (field === 'message') return; // Already handled above

      if (rule.conditions?.[`${field}_contains`]?.length) {
        rule.conditions[`${field}_contains`].forEach(value => {
          const key = `${field}-contains-${value}`;
          if (!addedConditions.has(key)) {
            newConditions.push({
              id: conditionId++,
              field,
              operator: 'contains',
              value
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
            value: rule.conditions[`${field}_exact`]
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
            value: rule.conditions[`${field}_regex`]
          });
          addedConditions.add(key);
        }
      }
    });

    // Handle network condition (special case)
    if (rule.conditions?.network) {
      const key = `network-contains-${rule.conditions.network}`;
      if (!addedConditions.has(key)) {
        newConditions.push({
          id: conditionId++,
          field: 'network',
          operator: 'contains',
          value: rule.conditions.network
        });
        addedConditions.add(key);
      }
    }

    setForm({
      system_mapping_id: rule.system_mapping_id || '',
      rule_name: rule.rule_name || '',
      description: rule.description || '',
      conditions: newConditions,
      logic_operator: rule.logic_operator || 'OR',
      incident_overrides: {
        short_description: rule.incident_overrides?.short_description || '',
        description: rule.incident_overrides?.description || '',
        u_system_failure: Boolean(rule.incident_overrides?.u_system_failure),
        ...Object.fromEntries(
          Object.entries(rule.incident_overrides || {})
            .filter(([k]) => !['short_description', 'description', 'u_system_failure'].includes(k))
        )
      },
      enabled: rule.enabled !== false
    });
    setEditingItem(rule);
    setShowForm(true);

    // Scroll to form
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
        <div style={{textAlign: 'center'}}>
          <RefreshCw size={32} style={{animation: 'spin 1s linear infinite', color: '#a855f7', marginBottom: 16}} />
          <div style={{fontSize: 18, color: '#475569', fontWeight: 500}}>Loading your rules...</div>
          <div style={{fontSize: 14, color: '#64748b', marginTop: 8}}>Setting up the magic</div>
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
          <div>
            <div style={{fontWeight: 600, color: '#dc2626', marginBottom: 4}}>Something went wrong</div>
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
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <Target size={28} />
            Rules
          </h2>
        </div>

        <div style={{display: 'flex', gap: 12}}>
          <button
            onClick={() => { reset(); setShowForm(!showForm); }}
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
              gap: 8,
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
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
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.target.style.borderColor = '#7c3aed';
              e.target.style.color = '#7c3aed';
            }}
            onMouseOut={(e) => {
              e.target.style.borderColor = '#e2e8f0';
              e.target.style.color = '#475569';
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {showForm && (
        <div 
          id="rule-form"
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
            background: 'linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)',
            borderRadius: '16px 16px 0 0'
          }} />

          <div style={{marginTop: 8}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
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
                  {editingItem 
                    ? 'Fine-tune how this rule handles alerts' 
                    : 'Set up conditions for when this rule should trigger'
                  }
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

            <form onSubmit={save} style={{display: 'flex', flexDirection: 'column', gap: 32}}>
              {/* Basic Rule Info */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                padding: 24,
                borderRadius: 12,
                border: '2px solid #e2e8f0'
              }}>
                <h4 style={{
                  margin: '0 0 20px 0', 
                  fontSize: 18, 
                  fontWeight: 600,
                  color: '#1e293b'
                }}>
                  Rule Setup
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
                      color: '#374151',
                      marginBottom: 8
                    }}>
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
                      onChange={(e) => setForm(p => ({...p, system_mapping_id: e.target.value}))}
                    >
                      <option value="">Choose a system mapping...</option>
                      {mappings.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.grafana_name} → {m.service_offering}
                        </option>
                      ))}
                    </select>
                    <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#6b7280'}}>
                      This provides the base incident settings
                    </p>
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: 8
                    }}>
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
                      onChange={(e) => setForm(p => ({...p, rule_name: e.target.value}))}
                      placeholder="e.g., ECK High CPU Alerts"
                    />
                  </div>

                  <div style={{gridColumn: '1 / -1'}}>
                    <label style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#374151',
                      marginBottom: 8
                    }}>
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
                      value={form.description}
                      onChange={(e) => setForm(p => ({...p, description: e.target.value}))}
                      placeholder="Describe when this rule should trigger..."
                    />
                  </div>
                </div>
              </div>

              {/* Condition Builder */}
              <div style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                padding: 24,
                borderRadius: 12,
                border: '2px solid #3b82f6'
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
                    color: '#1e40af'
                  }}>
                    WHEN Alert Matches...
                  </h4>

                  <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                    <div style={{
                      display: 'flex',
                      background: 'white',
                      borderRadius: 8,
                      border: '2px solid #93c5fd',
                      overflow: 'hidden'
                    }}>
                      <button
                        type="button"
                        onClick={() => setForm(p => ({...p, logic_operator: 'OR'}))}
                        style={{
                          background: form.logic_operator === 'OR' ? '#3b82f6' : 'white',
                          color: form.logic_operator === 'OR' ? 'white' : '#3b82f6',
                          border: 'none',
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        OR Logic
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(p => ({...p, logic_operator: 'AND'}))}
                        style={{
                          background: form.logic_operator === 'AND' ? '#3b82f6' : 'white',
                          color: form.logic_operator === 'AND' ? 'white' : '#3b82f6',
                          border: 'none',
                          padding: '8px 16px',
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        AND Logic
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={addCondition}
                      style={{
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
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

                <div style={{
                  background: 'white',
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid #93c5fd'
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: 14,
                    color: '#1e40af',
                    fontWeight: 500
                  }}>
                    <strong>{form.logic_operator} Logic:</strong> {
                      form.logic_operator === 'OR' 
                        ? 'Rule triggers when ANY condition matches'
                        : 'Rule triggers when ALL conditions match'
                    }
                  </p>
                </div>

                {form.conditions.length === 0 ? (
                  <div style={{
                    background: 'white',
                    padding: 32,
                    borderRadius: 8,
                    textAlign: 'center',
                    border: '2px dashed #93c5fd'
                  }}>
                    <Filter size={48} color="#93c5fd" style={{marginBottom: 16}} />
                    <h5 style={{margin: '0 0 8px 0', fontSize: 18, color: '#1e40af'}}>
                      No Conditions Yet
                    </h5>
                    <p style={{margin: 0, color: '#3730a3', marginBottom: 16}}>
                      Click "Add Condition" to start building your rule
                    </p>
                    <button
                      type="button"
                      onClick={addCondition}
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
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
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
                    {form.conditions.map((condition, index) => (
                      <div key={condition.id}>
                        <div style={{
                          background: 'white',
                          padding: 20,
                          borderRadius: 8,
                          border: '2px solid #bfdbfe',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: -1,
                            left: 16,
                            background: '#3b82f6',
                            color: 'white',
                            padding: '4px 12px',
                            borderRadius: '0 0 8px 8px',
                            fontSize: 12,
                            fontWeight: 600
                          }}>
                            Condition {index + 1}
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 2fr auto',
                            gap: 16,
                            alignItems: 'end',
                            marginTop: 12
                          }}>
                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#1e40af',
                                marginBottom: 6
                              }}>
                                Field
                              </label>
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
                                onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                              >
                                {Object.entries(CONDITION_FIELDS).map(([key, field]) => (
                                  <option key={key} value={key}>
                                    {field.icon} {field.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#1e40af',
                                marginBottom: 6
                              }}>
                                Operator
                              </label>
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
                                onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                              >
                                {Object.entries(CONDITION_OPERATORS).map(([key, op]) => (
                                  <option key={key} value={key}>
                                    {op.icon} {op.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#1e40af',
                                marginBottom: 6
                              }}>
                                Value
                              </label>
                              <input
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: '1px solid #bfdbfe',
                                  borderRadius: 6,
                                  fontSize: 14,
                                  background: 'white'
                                }}
                                value={condition.value}
                                onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                                placeholder={CONDITION_FIELDS[condition.field]?.placeholder || 'Enter value...'}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeCondition(condition.id)}
                              style={{
                                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
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
                          <div style={{
                            textAlign: 'center',
                            padding: '8px 0'
                          }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              background: form.logic_operator === 'OR' ? '#fef3c7' : '#dbeafe',
                              color: form.logic_operator === 'OR' ? '#f59e0b' : '#3b82f6',
                              padding: '4px 12px',
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 700
                            }}>
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

              {/* Incident Overrides */}
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
                  color: '#166534'
                }}>
                  THEN Override Incident Fields...
                </h4>

                <div style={{
                  background: 'white',
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 20,
                  border: '1px solid #86efac'
                }}>
                  <p style={{
                    margin: 0,
                    fontSize: 14,
                    color: '#166534',
                    fontWeight: 500
                  }}>
                    Template Variables: Use {'{{application}}'} {'{{object_name}}'} {'{{node_name}}'} {'{{message}}'} {'{{network}}'} {'{{time_created}}'}
                  </p>
                </div>

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
                      Short Description Template
                    </label>
                    <input
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #bbf7d0',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'white'
                      }}
                      value={form.incident_overrides.short_description}
                      onChange={(e) => setForm(p => ({
                        ...p, 
                        incident_overrides: {
                          ...p.incident_overrides, 
                          short_description: e.target.value
                        }
                      }))}
                      placeholder="Alert: {'{{object_name}}'} issue on {'{{node_name}}'}"
                    />
                  </div>

                  {selectedMapping && Object.keys(selectedMapping)
                    .filter(k => !['_id','grafana_name','service_offering','business_service','u_network','u_impact_technology','assignment_group','u_system_failure','created_at','updated_at'].includes(k))
                    .slice(0, 3)
                    .map(k => (
                      <div key={k}>
                        <label style={{
                          display: 'block',
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#166534',
                          marginBottom: 8
                        }}>
                          {k.replace(/_/g,' ')} Override
                        </label>
                        <input
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #bbf7d0',
                            borderRadius: 8,
                            fontSize: 14,
                            background: 'white'
                          }}
                          value={form.incident_overrides[k] || ''}
                          onChange={(e) => setForm(p => ({
                            ...p,
                            incident_overrides: {
                              ...p.incident_overrides,
                              [k]: e.target.value
                            }
                          }))}
                          placeholder={`Override ${k.replace(/_/g,' ')}`}
                        />
                        <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#15803d'}}>
                          Base: <strong>{selectedMapping[k] || '—'}</strong>
                        </p>
                      </div>
                    ))}

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
                        checked={form.incident_overrides.u_system_failure}
                        onChange={(e) => setForm(p => ({
                          ...p,
                          incident_overrides: {
                            ...p.incident_overrides,
                            u_system_failure: e.target.checked
                          }
                        }))}
                        style={{
                          width: 18,
                          height: 18,
                          accentColor: '#22c55e'
                        }}
                      />
                      Mark as System Failure?
                    </label>
                    <p style={{margin: '4px 0 0 30px', fontSize: 12, color: '#15803d'}}>
                      Override system failure setting
                    </p>
                  </div>

                  <div style={{gridColumn: '1 / -1'}}>
                    <label style={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#166534',
                      marginBottom: 8
                    }}>
                      Description Template
                    </label>
                    <textarea
                      style={{
                        width: '100%',
                        minHeight: 120,
                        padding: '12px 16px',
                        border: '2px solid #bbf7d0',
                        borderRadius: 8,
                        fontSize: 14,
                        background: 'white',
                        resize: 'vertical'
                      }}
                      value={form.incident_overrides.description}
                      onChange={(e) => setForm(p => ({
                        ...p,
                        incident_overrides: {
                          ...p.incident_overrides,
                          description: e.target.value
                        }
                      }))}
                      placeholder={`Alert Details:
Application: {'{{application}}'}
Object: {'{{object_name}}'}
Node: {'{{node_name}}'}
Network: {'{{network}}'}
Message: {'{{message}}'}
Time: {'{{time_created}}'}

Please investigate and take appropriate action.`}
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              {previewMode && selectedMapping && form.conditions.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)',
                  padding: 24,
                  borderRadius: 12,
                  border: '2px solid #eab308'
                }}>
                  <h4 style={{
                    margin: '0 0 16px 0',
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#92400e'
                  }}>
                    Preview: What Will Happen
                  </h4>

                  <div style={{
                    background: 'white',
                    padding: 20,
                    borderRadius: 8,
                    border: '1px solid #f59e0b'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      marginBottom: 16,
                      flexWrap: 'wrap'
                    }}>
                      <div style={{
                        background: '#3b82f6',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        IF {form.conditions.length} condition{form.conditions.length !== 1 ? 's' : ''} match ({form.logic_operator})
                      </div>
                      <div style={{color: '#64748b'}}>→</div>
                      <div style={{
                        background: '#10b981',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        THEN create incident with overrides
                      </div>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: 12
                    }}>
                      <div style={{
                        background: '#f8fafc',
                        padding: 12,
                        borderRadius: 6,
                        border: '1px solid #e2e8f0'
                      }}>
                        <div style={{fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4}}>
                          Short Description
                        </div>
                        <div style={{fontSize: 14, color: '#1e293b'}}>
                          {form.incident_overrides.short_description || `Alert from ${selectedMapping.grafana_name}`}
                          {form.incident_overrides.short_description && 
                            <span style={{color: '#10b981', fontSize: 12, marginLeft: 8}}>(custom)</span>
                          }
                        </div>
                      </div>

                      {form.incident_overrides.u_system_failure && (
                        <div style={{
                          background: '#fef2f2',
                          padding: 12,
                          borderRadius: 6,
                          border: '1px solid #fecaca'
                        }}>
                          <div style={{fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 4}}>
                            System Failure
                          </div>
                          <div style={{fontSize: 14, color: '#dc2626', fontWeight: 600}}>
                            YES (overridden)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 32px',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                    opacity: form.conditions.length === 0 ? 0.5 : 1
                  }}
                  disabled={form.conditions.length === 0}
                >
                  {editingItem ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rules List */}
      {rules.length === 0 ? (
        <div style={{
          background: 'linear-gradient(135deg, #fef7ff 0%, #fae8ff 100%)',
          border: '3px dashed #d8b4fe',
          borderRadius: 16,
          padding: 48,
          textAlign: 'center'
        }}>
          <div style={{fontSize: 48, marginBottom: 16}}>🎯</div>
          <h3 style={{fontSize: 24, fontWeight: 700, color: '#7c2d12', marginBottom: 12}}>
            No Rules Yet
          </h3>
          <p style={{fontSize: 16, color: '#a855f7', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px'}}>
            Create rules to handle specific alert types with custom conditions and incident settings.
          </p>
          {mappings.length === 0 && (
            <div style={{
              background: '#fef2f2',
              padding: 16,
              borderRadius: 8,
              border: '1px solid #fecaca',
              maxWidth: 400,
              margin: '0 auto'
            }}>
              <p style={{color: '#dc2626', fontWeight: 600, margin: 0}}>
                ⚠️ You need to create system mappings first!
              </p>
            </div>
          )}
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
              Your Rules ({rules.length})
            </h3>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
            {rules.map(rule => (
              <div key={rule._id} style={{
                background: 'white',
                borderRadius: 16,
                padding: 24,
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #f1f5f9',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: rule.enabled 
                    ? 'linear-gradient(90deg, #22c55e, #10b981)' 
                    : 'linear-gradient(90deg, #64748b, #475569)'
                }} />

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 20,
                  marginTop: 8
                }}>
                  <div style={{flex: 1}}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 8,
                      flexWrap: 'wrap'
                    }}>
                      <h4 style={{margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b'}}>
                        {rule.rule_name}
                      </h4>
                      <div style={{
                        background: rule.enabled ? '#dcfce7' : '#f1f5f9',
                        color: rule.enabled ? '#166534' : '#64748b',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {rule.enabled ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        {rule.enabled ? 'ACTIVE' : 'INACTIVE'}
                      </div>
                      <div style={{
                        background: '#e0f2fe',
                        color: '#0c4a6e',
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600
                      }}>
                        {rule.logic_operator || 'OR'} Logic
                      </div>
                    </div>

                    <p style={{margin: '0 0 8px 0', fontSize: 14, color: '#64748b'}}>
                      <strong>{rule.system_mapping?.grafana_name || 'Unknown'}</strong>
                      {rule.system_mapping?.service_offering && (
                        <span> → {rule.system_mapping.service_offering}</span>
                      )}
                    </p>

                    {rule.description && (
                      <p style={{margin: 0, fontSize: 13, color: '#64748b', fontStyle: 'italic'}}>
                        {rule.description}
                      </p>
                    )}
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                    <button
                      onClick={() => toggle(rule._id, !rule.enabled)}
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
                      {rule.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => startEdit(rule)}
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
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
                    <button
                      onClick={() => del(rule._id)}
                      style={{
                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
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

                {/* Conditions Display */}
                <div style={{
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  padding: 16,
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '2px solid #3b82f6'
                }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1e40af',
                    marginBottom: 12
                  }}>
                    Conditions ({rule.logic_operator || 'OR'} Logic)
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}>
                    {rule.conditions?.message_contains?.map((value, idx) => (
                      <div key={`msg-contains-${idx}`} style={{
                        background: 'white',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #93c5fd',
                        fontSize: 12
                      }}>
                        <span style={{fontWeight: 600, color: '#1e40af'}}>Message contains:</span>
                        <span style={{marginLeft: 8, fontFamily: 'monospace', color: '#3730a3'}}>"{value}"</span>
                      </div>
                    ))}

                    {rule.conditions?.message_regex && (
                      <div style={{
                        background: 'white',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #93c5fd',
                        fontSize: 12
                      }}>
                        <span style={{fontWeight: 600, color: '#1e40af'}}>Message regex:</span>
                        <span style={{marginLeft: 8, fontFamily: 'monospace', color: '#3730a3'}}>/{rule.conditions.message_regex}/</span>
                      </div>
                    )}

                    {rule.conditions?.message_exact && (
                      <div style={{
                        background: 'white',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #93c5fd',
                        fontSize: 12
                      }}>
                        <span style={{fontWeight: 600, color: '#1e40af'}}>Message equals:</span>
                        <span style={{marginLeft: 8, fontFamily: 'monospace', color: '#3730a3'}}>"{rule.conditions.message_exact}"</span>
                      </div>
                    )}

                    {rule.conditions?.node_name_contains?.map((value, idx) => (
                      <div key={`node-contains-${idx}`} style={{
                        background: 'white',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #93c5fd',
                        fontSize: 12
                      }}>
                        <span style={{fontWeight: 600, color: '#1e40af'}}>Node contains:</span>
                        <span style={{marginLeft: 8, fontFamily: 'monospace', color: '#3730a3'}}>"{value}"</span>
                      </div>
                    ))}

                    {rule.conditions?.object_name_contains?.map((value, idx) => (
                      <div key={`obj-contains-${idx}`} style={{
                        background: 'white',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #93c5fd',
                        fontSize: 12
                      }}>
                        <span style={{fontWeight: 600, color: '#1e40af'}}>Object contains:</span>
                        <span style={{marginLeft: 8, fontFamily: 'monospace', color: '#3730a3'}}>"{value}"</span>
                      </div>
                    ))}

                    {rule.conditions?.network && (
                      <div style={{
                        background: 'white',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #93c5fd',
                        fontSize: 12
                      }}>
                        <span style={{fontWeight: 600, color: '#1e40af'}}>Network:</span>
                        <span style={{marginLeft: 8, fontFamily: 'monospace', color: '#3730a3'}}>"{rule.conditions.network}"</span>
                      </div>
                    )}

                    {rule.conditions?.operator_contains?.map((value, idx) => (
                      <div key={`op-contains-${idx}`} style={{
                        background: 'white',
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #93c5fd',
                        fontSize: 12
                      }}>
                        <span style={{fontWeight: 600, color: '#1e40af'}}>Operator contains:</span>
                        <span style={{marginLeft: 8, fontFamily: 'monospace', color: '#3730a3'}}>"{value}"</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overrides Display */}
                {rule.incident_overrides && Object.keys(rule.incident_overrides).length > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 16,
                    border: '2px solid #22c55e'
                  }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#166534',
                      marginBottom: 12
                    }}>
                      Incident Overrides
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                      gap: 8
                    }}>
                      {rule.incident_overrides.short_description && (
                        <div style={{
                          background: 'white',
                          padding: 8,
                          borderRadius: 4,
                          border: '1px solid #86efac',
                          fontSize: 12
                        }}>
                          <span style={{fontWeight: 600, color: '#166534'}}>Short description:</span>
                          <div style={{marginTop: 4, color: '#15803d'}}>{rule.incident_overrides.short_description}</div>
                        </div>
                      )}

                      {rule.incident_overrides.u_system_failure && (
                        <div style={{
                          background: '#fef2f2',
                          padding: 8,
                          borderRadius: 4,
                          border: '1px solid #fecaca',
                          fontSize: 12
                        }}>
                          <span style={{fontWeight: 600, color: '#dc2626'}}>System Failure:</span>
                          <div style={{marginTop: 4, color: '#dc2626', fontWeight: 600}}>YES</div>
                        </div>
                      )}

                      {Object.entries(rule.incident_overrides || {})
                        .filter(([k]) => !['short_description', 'description', 'u_system_failure'].includes(k))
                        .map(([k, v]) => (
                          <div key={k} style={{
                            background: 'white',
                            padding: 8,
                            borderRadius: 4,
                            border: '1px solid #86efac',
                            fontSize: 12
                          }}>
                            <span style={{fontWeight: 600, color: '#166534'}}>{k.replace(/_/g, ' ')}:</span>
                            <div style={{marginTop: 4, color: '#15803d'}}>{String(v)}</div>
                          </div>
                        ))}
                    </div>

                    {rule.incident_overrides.description && (
                      <div style={{marginTop: 12}}>
                        <div style={{fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 4}}>
                          Description template:
                        </div>
                        <div style={{
                          background: 'white',
                          border: '1px solid #86efac',
                          borderRadius: 4,
                          padding: 10,
                          whiteSpace: 'pre-wrap',
                          maxHeight: 120,
                          overflow: 'auto',
                          fontSize: 11,
                          color: '#15803d'
                        }}>
                          {rule.incident_overrides.description}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Meta info */}
                {rule.created_at && (
                  <div style={{
                    paddingTop: 16,
                    borderTop: '1px solid #f1f5f9',
                    fontSize: 12,
                    color: '#94a3b8'
                  }}>
                    Created: {new Date(rule.created_at).toLocaleString()}
                    {rule.updated_at && rule.updated_at !== rule.created_at && (
                      <span> • Updated: {new Date(rule.updated_at).toLocaleString()}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentRules;