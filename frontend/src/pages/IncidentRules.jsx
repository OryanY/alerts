import React, { useEffect, useMemo, useState } from 'react';
import { S } from '../utils/styles.jsx';
import {
  Target, Plus, Edit, Trash2, RefreshCw, ArrowRight, CheckCircle, XCircle,
  Eye, Zap, AlertTriangle, FileText, ToggleLeft, ToggleRight
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/incidents';

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
    conditions: {
      message_contains: [],
      message_regex: '',
      message_exact: '',
      node_name_contains: [],
      object_name_contains: [],
      network: ''
    },
    incident_overrides: {
      short_description: '',
      description: ''
    },
    enabled: true,
    priority_order: 1
  });

  const selectedMapping = useMemo(() => {
    try { return mappings.find(m => String(m._id) === String(form.system_mapping_id)); }
    catch { return undefined; }
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
      // silent
    }
  };

  useEffect(() => { fetchMappings(); fetchRules(); }, []);

  const reset = () => {
    setForm({
      system_mapping_id: '',
      rule_name: '',
      description: '',
      conditions: {
        message_contains: [],
        message_regex: '',
        message_exact: '',
        node_name_contains: [],
        object_name_contains: [],
        network: ''
      },
      incident_overrides: {
        short_description: '',
        description: ''
      },
      enabled: true,
      priority_order: 1
    });
    setEditingItem(null);
    setPreviewMode(false);
  };

  const arrayInput = (field, value) => {
    const items = value.split(',').map(x => x.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, conditions: { ...prev.conditions, [field]: items } }));
  };

  const save = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    try {
      const cleanConditions = {};
      Object.entries(form.conditions).forEach(([k, v]) => {
        if (Array.isArray(v) && v.length) cleanConditions[k] = v;
        else if (typeof v === 'string' && v.trim()) cleanConditions[k] = v.trim();
      });
      const cleanOverrides = {};
      Object.entries(form.incident_overrides).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) cleanOverrides[k] = v.trim();
      });
      const payload = {
        ...form,
        conditions: cleanConditions,
        incident_overrides: Object.keys(cleanOverrides).length ? cleanOverrides : undefined
      };
      const url = editingItem ? `${API_BASE}/incident-rules/${editingItem._id}` : `${API_BASE}/incident-rules`;
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        await fetchRules();
        reset();
        setShowForm(false);
      } else setError(data.details || 'Failed to save rule');
    } catch (e) {
      setError('Error saving rule: ' + e.message);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      const res = await fetch(`${API_BASE}/incident-rules/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await fetchRules();
      else setError(data.details || 'Failed to delete rule');
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
      if (data.success) await fetchRules();
      else setError(data.details || 'Failed to toggle rule');
    } catch (e) {
      setError('Error toggling rule: ' + e.message);
    }
  };

  const startEdit = (rule) => {
    setForm({
      system_mapping_id: rule.system_mapping_id || '',
      rule_name: rule.rule_name || '',
      description: rule.description || '',
      conditions: {
        message_contains: rule.conditions?.message_contains || [],
        message_regex: rule.conditions?.message_regex || '',
        message_exact: rule.conditions?.message_exact || '',
        node_name_contains: rule.conditions?.node_name_contains || [],
        object_name_contains: rule.conditions?.object_name_contains || [],
        network: rule.conditions?.network || ''
      },
      incident_overrides: {
        ...(rule.incident_overrides || {}),
        short_description: rule.incident_overrides?.short_description || '',
        description: rule.incident_overrides?.description || ''
      },
      enabled: rule.enabled !== false,
      priority_order: rule.priority_order || 1
    });
    setEditingItem(rule);
    setShowForm(true);
  };

  // Generate preview incident based on current form (placeholder for future enrichment)
  const generatePreview = () => {
    if (!selectedMapping) return null;
    return {
      base: selectedMapping,
      overrides: form.incident_overrides,
      conditions: form.conditions
    };
  };

  const hasActiveConditions = () => {
    const { conditions } = form;
    return conditions.message_contains?.length > 0 ||
           conditions.message_regex?.trim() ||
           conditions.message_exact?.trim() ||
           conditions.node_name_contains?.length > 0 ||
           conditions.object_name_contains?.length > 0 ||
           conditions.network?.trim();
  };

  if (loading) return <div style={S.loading}>Loading incident rules…</div>;

  return (
    <div>

      <div style={{marginBottom: 24}}>
        <button
          style={{...S.button, display: 'inline-flex', alignItems: 'center', gap: 8}}
          onClick={() => { reset(); setShowForm(!showForm); }}
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Add New Rule'}
        </button>
        <button
          style={{...S.buttonSecondary, display: 'inline-flex', alignItems: 'center', gap: 8}}
          onClick={fetchRules}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {showForm && (
        <form style={{...S.form, position: 'relative'}} onSubmit={save}>
          {/* Form header bar */}
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #a855f7, #7c3aed)', borderRadius: '8px 8px 0 0'}} />

          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
            <h3 style={{margin: 0, color: '#1e293b', fontSize: 20, display: 'flex', alignItems: 'center', gap: 8}}>
              {editingItem ? <Edit size={20} /> : <Plus size={20} />}
              {editingItem ? 'Edit Incident Rule' : 'Create New Incident Rule'}
            </h3>

            <button
              type="button"
              style={{...S.buttonSecondary, display: 'inline-flex', alignItems: 'center', gap: 6}}
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye size={14} />
              {previewMode ? 'Hide Preview' : 'Show Preview'}
            </button>
          </div>

          {/* Basic Rule Info */}
          <div style={{background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20, border: '2px solid #e2e8f0'}}>
            <h4 style={{margin: '0 0 16px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8}}>
              <Target size={18} />
              Rule Configuration
            </h4>

            <div style={S.formGrid}>
              <div style={S.formGroup}>
                <label style={S.formLabel}>System Mapping *</label>
                <select
                  style={S.select}
                  required
                  value={form.system_mapping_id}
                  onChange={(e) => setForm(p => ({...p, system_mapping_id: e.target.value}))}
                >
                  <option value="">Select system mapping</option>
                  {mappings.map(m => (
                    <option key={m._id} value={m._id}>{m.grafana_name} - {m.service_offering}</option>
                  ))}
                </select>
                <small style={{color: '#64748b', marginTop: 4}}>This provides the base incident settings</small>
              </div>

              <div style={S.formGroup}>
                <label style={S.formLabel}>Rule Name *</label>
                <input
                  style={S.input}
                  required
                  value={form.rule_name}
                  onChange={(e) => setForm(p => ({...p, rule_name: e.target.value}))}
                  placeholder="e.g., ECK High CPU Usage"
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.formLabel}>Description</label>
                <input
                  style={S.input}
                  value={form.description}
                  onChange={(e) => setForm(p => ({...p, description: e.target.value}))}
                  placeholder="Describe when this rule should trigger"
                />
              </div>

              <div style={S.formGroup}>
                <label style={S.formLabel}>Priority Order</label>
                <input
                  style={S.input}
                  type="number"
                  min="1"
                  value={form.priority_order}
                  onChange={(e) => setForm(p => ({...p, priority_order: parseInt(e.target.value) || 1}))}
                />
                <small style={{color: '#64748b', marginTop: 4}}>Higher numbers = higher priority</small>
              </div>
            </div>
          </div>

          {/* Conditions Section */}
          <div style={{background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: 20, borderRadius: 12, marginBottom: 20, border: '2px solid #3b82f6'}}>
            <h4 style={{margin: '0 0 16px 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8}}>
              <AlertTriangle size={18} />
              🎯 WHEN Alert Matches These Conditions...
              {hasActiveConditions() && <CheckCircle size={16} color="#10b981" />}
            </h4>

            <div style={{background: 'white', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #93c5fd'}}>
              <small style={{color: '#1e40af', fontWeight: 600}}>
                ⚡ At least ONE condition must be specified. The rule will trigger when ANY condition matches (OR logic).
              </small>
            </div>

            <div style={S.formGrid}>
              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#1e40af'}}>💬 Message Contains (OR logic)</label>
                <input
                  style={S.input}
                  value={form.conditions.message_contains.join(', ')}
                  onChange={(e) => arrayInput('message_contains', e.target.value)}
                  placeholder="CPU, memory, disk, error"
                />
                <small style={{color: '#3730a3', marginTop: 4}}>
                  Example: "CPU, memory" ← matches if alert message contains "CPU" OR "memory"
                </small>
              </div>

              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#1e40af'}}>🔍 Message Regex Pattern</label>
                <input
                  style={S.input}
                  value={form.conditions.message_regex}
                  onChange={(e) => setForm(p => ({...p, conditions: {...p.conditions, message_regex: e.target.value}}))}
                  placeholder="CPU.*high|high.*CPU"
                />
                <small style={{color: '#3730a3', marginTop: 4}}>
                  Advanced pattern matching for complex conditions
                </small>
              </div>

              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#1e40af'}}>📝 Message Exact Match</label>
                <input
                  style={S.input}
                  value={form.conditions.message_exact}
                  onChange={(e) => setForm(p => ({...p, conditions: {...p.conditions, message_exact: e.target.value}}))}
                  placeholder="Exact message text"
                />
              </div>

              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#1e40af'}}>🖥️ Node Name Contains</label>
                <input
                  style={S.input}
                  value={form.conditions.node_name_contains.join(', ')}
                  onChange={(e) => arrayInput('node_name_contains', e.target.value)}
                  placeholder="prod, staging, worker"
                />
              </div>

              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#1e40af'}}>🎯 Object Name Contains</label>
                <input
                  style={S.input}
                  value={form.conditions.object_name_contains.join(', ')}
                  onChange={(e) => arrayInput('object_name_contains', e.target.value)}
                  placeholder="elasticsearch, kibana, beats"
                />
              </div>

              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#1e40af'}}>🌐 Network</label>
                <input
                  style={S.input}
                  value={form.conditions.network}
                  onChange={(e) => setForm(p => ({...p, conditions: {...p.conditions, network: e.target.value}}))}
                  placeholder="prod-net, staging-net"
                />
              </div>
            </div>
          </div>

          {/* Incident Overrides Section */}
          <div style={{background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: 20, borderRadius: 12, marginBottom: 20, border: '2px solid #22c55e'}}>
            <h4 style={{margin: '0 0 16px 0', color: '#166534', display: 'flex', alignItems: 'center', gap: 8}}>
              <Zap size={18} />
              ⚡ THEN Override These Incident Fields...
            </h4>

            <div style={{background: 'white', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #86efac'}}>
              <small style={{color: '#166534', fontWeight: 600}}>
                🎨 These will override the base mapping values. Use template variables like 
              </small>
            </div>

            <div style={S.formGrid}>
              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#166534'}}>📋 Short Description Template</label>
                <input
                  style={S.input}
                  value={form.incident_overrides.short_description}
                  onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, short_description: e.target.value}}))}
                  placeholder="High CPU Alert: {{object_name}} on {{node_name}}"
                />
                <small style={{color: '#15803d', marginTop: 4}}>
                  Variables: application, object_name, node_name, message, network, time_created
                </small>
              </div>

              {selectedMapping ? (
                Object.keys(selectedMapping)
                  .filter(k => !['_id','grafana_name','service_offering','business_service','enabled','created_at','updated_at'].includes(k))
                  .map(k => (
                    <div key={k} style={S.formGroup}>
                      <label style={{...S.formLabel, color: '#166534'}}>{k.replace(/_/g,' ')} Override</label>
                      <input
                        style={S.input}
                        value={form.incident_overrides[k] ?? ''}
                        onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, [k]: e.target.value}}))}
                        placeholder={`Override ${k.replace(/_/g,' ')}`}
                      />
                      <small style={{color: '#15803d', marginTop: 4}}>
                        Base value: <strong>{selectedMapping[k] != null ? String(selectedMapping[k]) : '—'}</strong>
                      </small>
                    </div>
                  ))
              ) : (
                <div style={{gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: 20}}>
                  Select a system mapping to see available field overrides
                </div>
              )}

              <div style={{...S.formGroup, gridColumn: '1 / -1'}}>
                <label style={{...S.formLabel, color: '#166534'}}>📄 Description Template</label>
                <textarea
                  style={{...S.textarea, minHeight: 100}}
                  value={form.incident_overrides.description}
                  onChange={(e) => setForm(p => ({...p, incident_overrides: {...p.incident_overrides, description: e.target.value}}))}
                  placeholder={`Alert Details:
Application: {{application}}
Object: {{object_name}}
Node: {{node_name}}
Network: {{network}}
Message: {{message}}
Time: {{time_created}}

Please investigate and take appropriate action.`}
                />
              </div>
            </div>
          </div>

          {/* Preview Section */}
          {previewMode && selectedMapping && hasActiveConditions() && (
            <div style={{background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)', padding: 20, borderRadius: 12, marginBottom: 20, border: '2px solid #eab308'}}>
              <h4 style={{margin: '0 0 16px 0', color: '#92400e', display: 'flex', alignItems: 'center', gap: 8}}>
                <Eye size={18} />
                📋 RESULT: Incident Preview
              </h4>

              <div style={{background: 'white', padding: 16, borderRadius: 8, border: '1px solid #f59e0b'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12}}>
                  <div style={{...S.pill('#3b82f6'), fontSize: 12}}>Base Mapping</div>
                  <Plus size={14} color="#64748b" />
                  <div style={{...S.pill('#10b981'), fontSize: 12}}>Your Overrides</div>
                  <ArrowRight size={14} color="#64748b" />
                  <div style={{...S.pill('#f59e0b'), fontSize: 12}}>Final Incident</div>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12}}>
                  <div style={{...S.kvBox, background: '#f8fafc', border: '1px solid #cbd5e1'}}>
                    <div style={{...S.kvKey, color: '#475569'}}>Application</div>
                    <div style={S.kvVal}>{selectedMapping.grafana_name}</div>
                  </div>
                  <div style={{...S.kvBox, background: '#f8fafc', border: '1px solid #cbd5e1'}}>
                    <div style={{...S.kvKey, color: '#475569'}}>Assignment Group</div>
                    <div style={S.kvVal}>
                      {form.incident_overrides.assignment_group || selectedMapping.assignment_group}
                      {form.incident_overrides.assignment_group && <span style={{color: '#10b981', fontSize: 12}}> (overridden)</span>}
                    </div>
                  </div>
                  <div style={{...S.kvBox, background: '#f8fafc', border: '1px solid #cbd5e1'}}>
                    <div style={{...S.kvKey, color: '#475569'}}>Short Description</div>
                    <div style={S.kvVal}>
                      {form.incident_overrides.short_description || `Alert from ${selectedMapping.grafana_name}`}
                      {form.incident_overrides.short_description && <span style={{color: '#10b981', fontSize: 12}}> (custom template)</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={S.formActions}>
            <button
              type="button"
              style={{...S.buttonSecondary, display: 'inline-flex', alignItems: 'center', gap: 8}}
              onClick={() => { reset(); setShowForm(false); }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{...S.button, display: 'inline-flex', alignItems: 'center', gap: 8}}
            >
              {editingItem ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <div style={{...S.noItems, background: 'linear-gradient(135deg, #fef7ff 0%, #fae8ff 100%)', border: '2px dashed #d8b4fe'}}>
          <h3 style={{color: '#7c2d12'}}>No Incident Rules Found</h3>
          <p style={{color: '#a855f7'}}>Create incident rules to handle specific alert types with custom conditions and incident settings.</p>
          {mappings.length === 0 && (
            <div style={{marginTop: 16, padding: 12, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca'}}>
              <p style={{color: '#dc2626', fontWeight: 600, margin: 0}}>
                ⚠️ You need to create system mappings first before creating rules.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div>
          <h3 style={{color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8}}>
            <Target size={20} />
            Incident Rules ({rules.length})
          </h3>

          {rules.map(rule => (
            <div key={rule._id} style={{...S.card(), position: 'relative', overflow: 'hidden'}}>
              {/* Priority indicator bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                background: `linear-gradient(90deg, ${rule.enabled ? '#10b981' : '#64748b'}, ${rule.enabled ? '#059669' : '#475569'})`
              }} />

              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, marginTop: 8}}>
                <div style={{flex: 1}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8}}>
                    <h4 style={{margin: 0, color: '#1e293b', fontSize: 18}}>{rule.rule_name}</h4>
                    <div style={{...S.pill(rule.enabled ? '#10b981' : '#64748b'), fontSize: 11}}>
                      Priority {rule.priority_order}
                    </div>
                    <div style={{...S.pill(rule.enabled ? '#10b981' : '#64748b'), fontSize: 11, display: 'flex', alignItems: 'center', gap: 4}}>
                      {rule.enabled ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {rule.enabled ? 'ENABLED' : 'DISABLED'}
                    </div>
                  </div>

                  <div style={{fontSize: 14, color: '#64748b', marginBottom: 4}}>
                    📊 Application: <strong>{rule.grafana_name || 'Unknown'}</strong>
                    {rule.system_mapping && (
                      <span> | 🎯 Service: <strong>{rule.system_mapping.service_offering}</strong></span>
                    )}
                  </div>

                  {rule.description && (
                    <div style={{fontSize: 13, color: '#64748b', fontStyle: 'italic'}}>{rule.description}</div>
                  )}
                </div>

                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                  <button
                    style={{
                      ...S.buttonSecondary,
                      fontSize: 11,
                      padding: '6px 12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: rule.enabled ? '#f59e0b' : '#10b981',
                      color: 'white'
                    }}
                    onClick={() => toggle(rule._id, !rule.enabled)}
                  >
                    {rule.enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    style={{...S.buttonSecondary, fontSize: 11, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4}}
                    onClick={() => startEdit(rule)}
                  >
                    <Edit size={12} />
                    Edit
                  </button>
                  <button
                    style={{...S.buttonDanger, fontSize: 11, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4}}
                    onClick={() => del(rule._id)}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>

              {/* Visual Rule Flow */}
              <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                padding: 16,
                borderRadius: 8,
                marginBottom: 16,
                border: '2px solid #e2e8f0'
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
                  <div style={{...S.pill('#3b82f6'), fontSize: 12, display: 'flex', alignItems: 'center', gap: 4}}>
                    <AlertTriangle size={12} />
                    IF Alert matches
                  </div>
                  <ArrowRight size={14} color="#64748b" />
                  <div style={{...S.pill('#f59e0b'), fontSize: 12}}>
                    Use {rule.system_mapping?.service_offering || 'base mapping'}
                  </div>
                  <ArrowRight size={14} color="#64748b" />
                  <div style={{...S.pill('#10b981'), fontSize: 12, display: 'flex', alignItems: 'center', gap: 4}}>
                    <Zap size={12} />
                    Apply {Object.keys(rule.incident_overrides || {}).length} overrides
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div style={{background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', padding: 16, borderRadius: 8, marginBottom: 16, border: '2px solid #3b82f6'}}>
                <div style={{fontSize: 14, fontWeight: 600, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
                  🎯 Matching Conditions (any of these will trigger the rule)
                </div>

                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8}}>
                  {rule.conditions?.message_contains?.length > 0 && (
                    <div style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #93c5fd'}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#1e40af'}}>💬 Message contains: </span>
                      <span style={{fontSize: 12, color: '#1e40af', fontFamily: 'monospace'}}>{rule.conditions.message_contains.join(', ')}</span>
                    </div>
                  )}
                  {rule.conditions?.message_regex && (
                    <div style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #93c5fd'}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#1e40af'}}>🔍 Message regex: </span>
                      <span style={{fontSize: 12, color: '#1e40af', fontFamily: 'monospace'}}>{rule.conditions.message_regex}</span>
                    </div>
                  )}
                  {rule.conditions?.message_exact && (
                    <div style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #93c5fd'}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#1e40af'}}>📝 Message exact: </span>
                      <span style={{fontSize: 12, color: '#1e40af', fontFamily: 'monospace'}}>{rule.conditions.message_exact}</span>
                    </div>
                  )}
                  {rule.conditions?.node_name_contains?.length > 0 && (
                    <div style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #93c5fd'}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#1e40af'}}>🖥️ Node contains: </span>
                      <span style={{fontSize: 12, color: '#1e40af', fontFamily: 'monospace'}}>{rule.conditions.node_name_contains.join(', ')}</span>
                    </div>
                  )}
                  {rule.conditions?.object_name_contains?.length > 0 && (
                    <div style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #93c5fd'}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#1e40af'}}>🎯 Object contains: </span>
                      <span style={{fontSize: 12, color: '#1e40af', fontFamily: 'monospace'}}>{rule.conditions.object_name_contains.join(', ')}</span>
                    </div>
                  )}
                  {rule.conditions?.network && (
                    <div style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #93c5fd'}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#1e40af'}}>🌐 Network: </span>
                      <span style={{fontSize: 12, color: '#1e40af', fontFamily: 'monospace'}}>{rule.conditions.network}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Overrides */}
              {rule.incident_overrides && Object.keys(rule.incident_overrides).length > 0 && (
                <div style={{background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', padding: 16, borderRadius: 8, marginBottom: 16, border: '2px solid #22c55e'}}>
                  <div style={{fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6}}>
                    ⚙️ Incident Field Overrides
                  </div>

                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 8}}>
                    {rule.incident_overrides.short_description && (
                      <div style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #86efac'}}>
                        <span style={{fontSize: 12, fontWeight: 600, color: '#166534'}}>📋 Short description: </span>
                        <span style={{fontSize: 12, color: '#166534'}}>{rule.incident_overrides.short_description}</span>
                      </div>
                    )}

                    {Object.entries(rule.incident_overrides || {})
                      .filter(([k]) => !['short_description','description'].includes(k))
                      .filter(([k]) => !['_id','grafana_name','service_offering','business_service','enabled','created_at','updated_at'].includes(k))
                      .map(([k, v]) => (
                        <div key={k} style={{background: 'white', padding: 8, borderRadius: 4, border: '1px solid #86efac'}}>
                          <span style={{fontSize: 12, fontWeight: 600, color: '#166534'}}>{k.replace(/_/g,' ')}: </span>
                          <span style={{fontSize: 12, color: '#166534'}}>{String(v)}</span>
                        </div>
                      ))
                    }
                  </div>

                  {rule.incident_overrides.description && (
                    <div style={{marginTop: 8}}>
                      <span style={{fontSize: 12, fontWeight: 600, color: '#166534'}}>🧾 Description template: </span>
                      <div style={{ display:'block', marginTop:5, padding:10, whiteSpace:'pre-wrap', maxHeight:120, overflow:'auto', background:'white', border:'1px solid #86efac', borderRadius:4 }}>
                        {rule.incident_overrides.description}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Meta */}
              {rule.created_at && (
                <div style={S.metaRow}>
                  Created: {new Date(rule.created_at).toLocaleString()}
                  {rule.updated_at && rule.updated_at !== rule.created_at && (
                    <span> | Updated: {new Date(rule.updated_at).toLocaleString()}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncidentRules;
