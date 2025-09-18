import React, { useEffect, useState } from 'react';
import { S } from '../utils/styles.jsx';
import { Settings, Plus, Edit, Trash2, RefreshCw, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:5000/api/incidents';

const IncidentMappings = () => {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [additionalFields, setAdditionalFields] = useState({});
  const [loadingFields, setLoadingFields] = useState(false);

  const [form, setForm] = useState({
    grafana_name: '',
    service_offering: '',
    business_service: '',
    u_network: '',
    u_impact_technology: '',
    assignment_group: '',
  });

  const baseMandatoryFields = [
    'service_offering',
    'business_service', 
    'u_network',
    'u_impact_technology',
    'assignment_group'
  ];

  const reset = () => {
    setForm({
      grafana_name: '',
      service_offering: '',
      business_service: '',
      u_site: '',
      u_network: '',
      u_impact_technology: '',
      assignment_group: '',
    });
    setEditingItem(null);
    setAdditionalFields({});
  };

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/system-mappings`);
      const data = await res.json();
      if (data.success) setMappings(data.data || []);
      else setError(data.details || 'Failed to fetch system mappings');
    } catch (e) {
      setError('Error connecting to server: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch additional mandatory fields from ServiceNow when service offering changes
  const fetchAdditionalFields = async (serviceOffering) => {
    if (!serviceOffering.trim()) {
      setAdditionalFields({});
      return;
    }

    try {
      setLoadingFields(true);
      const res = await fetch(`${API_BASE}/servicenow-fields?service_offering=${encodeURIComponent(serviceOffering)}`);
      const data = await res.json();
      
      if (data.success && data.additionalFields) {
        setAdditionalFields(data.additionalFields);
        // Add additional fields to form state
        setForm(prev => ({
          ...prev,
          ...Object.keys(data.additionalFields).reduce((acc, key) => ({
            ...acc,
            [key]: prev[key] || ''
          }), {})
        }));
      } else {
        setAdditionalFields({});
      }
    } catch (e) {
      console.warn('Could not fetch additional fields:', e.message);
      setAdditionalFields({});
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => { fetchMappings(); }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const url = editingItem ? `${API_BASE}/system-mappings/${editingItem._id}` : `${API_BASE}/system-mappings`;
      const method = editingItem ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        await fetchMappings();
        reset();
        setShowForm(false);
      } else {
        setError(data.details || 'Failed to save mapping');
      }
    } catch (e) {
      setError('Error saving mapping: ' + e.message);
    }
  };

  const startEdit = (m) => {
    const formData = {
      grafana_name: m.grafana_name || '',
      service_offering: m.service_offering || '',
      business_service: m.business_service || '',
      u_site: m.u_site || '',
      u_network: m.u_network || '',
      u_impact_technology: m.u_impact_technology || '',
      assignment_group: m.assignment_group || '',
    };
    
    // Add any additional fields from the mapping
    Object.keys(m).forEach(key => {
      if (!baseMandatoryFields.includes(key) && !['_id', 'grafana_name', 'created_at', 'updated_at'].includes(key)) {
        formData[key] = m[key] || '';
      }
    });

    setForm(formData);
    setEditingItem(m);
    setShowForm(true);
    
    // Fetch additional fields for this service offering
    if (m.service_offering) {
      fetchAdditionalFields(m.service_offering);
    }
  };

  const del = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    try {
      const res = await fetch(`${API_BASE}/system-mappings/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) await fetchMappings();
      else setError(data.details || 'Failed to delete mapping');
    } catch (e) {
      setError('Error deleting mapping: ' + e.message);
    }
  };

  if (loading) return <div style={S.loading}>Loading system mappings…</div>;

  return (
    <div>

      <div style={{marginBottom: 24}}>
        <button
          style={{...S.button, display: 'inline-flex', alignItems: 'center', gap: 8}}
          onClick={() => { reset(); setShowForm(!showForm); }}
        >
          <Plus size={16} />
          {showForm ? 'Cancel' : 'Add New Mapping'}
        </button>
        <button 
          style={{...S.buttonSecondary, display: 'inline-flex', alignItems: 'center', gap: 8}} 
          onClick={fetchMappings}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {showForm && (
        <div style={{...S.form, position: 'relative'}}>
          {/* Form header bar */}
          <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #3b82f6, #1e40af)', borderRadius: '8px 8px 0 0'}}></div>
          
          <h3 style={{marginTop: 0, color: '#1e293b', fontSize: 20, display: 'flex', alignItems: 'center', gap: 8}}>
            {editingItem ? <Edit size={20} /> : <Plus size={20} />}
            {editingItem ? 'Edit System Mapping' : 'Create New System Mapping'}
          </h3>

          <div onSubmit={save}>
            {/* Application Name Section */}
            <div style={{background: '#f1f5f9', padding: 16, borderRadius: 8, marginBottom: 20, border: '2px solid #e2e8f0'}}>
              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#1e40af', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6}}>
                  📊 Grafana Application Name *
                </label>
                <input 
                  style={{...S.input, fontSize: 16, padding: 12}} 
                  value={form.grafana_name} 
                  onChange={(e) => setForm(p => ({...p, grafana_name: e.target.value}))} 
                  required 
                  placeholder="e.g., eck, prometheus, kibana" 
                />
                <small style={{color: '#64748b', marginTop: 4}}>This is the application name from Grafana alerts</small>
              </div>
            </div>

            {/* Service Offering Section */}
            <div style={{background: '#fef7ff', padding: 16, borderRadius: 8, marginBottom: 20, border: '2px solid #e9d5ff'}}>
              <div style={S.formGroup}>
                <label style={{...S.formLabel, color: '#7c2d12', fontSize: 16, display: 'flex', alignItems: 'center', gap: 6}}>
                  🎯 Service Offering *
                </label>
                <input 
                  style={{...S.input, fontSize: 16, padding: 12}} 
                  value={form.service_offering} 
                  onChange={(e) => {
                    setForm(p => ({...p, service_offering: e.target.value}));
                    fetchAdditionalFields(e.target.value);
                  }}
                  required 
                  placeholder="e.g., Elastic - eck, Prometheus Monitoring" 
                />
                <small style={{color: '#64748b', marginTop: 4}}>
                  This will determine additional required fields from ServiceNow
                  {loadingFields && <span> - Loading additional fields...</span>}
                </small>
              </div>
            </div>

            {/* Base Mandatory Fields */}
            <div style={{background: 'white', padding: 16, borderRadius: 8, marginBottom: 20, border: '2px solid #10b981'}}>
              <h4 style={{margin: '0 0 16px 0', color: '#059669', display: 'flex', alignItems: 'center', gap: 8}}>
                <CheckCircle size={18} />
                Base Mandatory Fields
              </h4>
              
              <div style={S.formGrid}>
                <div style={S.formGroup}>
                  <label style={S.formLabel}>Business Service *</label>
                  <input 
                    style={S.input} 
                    value={form.business_service} 
                    onChange={(e) => setForm(p => ({...p, business_service: e.target.value}))} 
                    required 
                    placeholder="e.g., מאגר מידע" 
                  />
                </div>
                
                
                <div style={S.formGroup}>
                  <label style={S.formLabel}>Network *</label>
                  <input 
                    style={S.input} 
                    value={form.u_network} 
                    onChange={(e) => setForm(p => ({...p, u_network: e.target.value}))} 
                    required 
                    placeholder="e.g., רשת א" 
                  />
                </div>
                
                <div style={S.formGroup}>
                  <label style={S.formLabel}>Impact Technology *</label>
                  <input 
                    style={S.input} 
                    value={form.u_impact_technology} 
                    onChange={(e) => setForm(p => ({...p, u_impact_technology: e.target.value}))} 
                    required 
                    placeholder="e.g., יריעה משרידות" 
                  />
                </div>
                
                <div style={S.formGroup}>
                  <label style={S.formLabel}>Assignment Group *</label>
                  <input 
                    style={S.input} 
                    value={form.assignment_group} 
                    onChange={(e) => setForm(p => ({...p, assignment_group: e.target.value}))} 
                    required 
                    placeholder="e.g., צוות מאגרים" 
                  />
                </div>
              </div>
            </div>

            {/* Additional ServiceNow Fields */}
            {Object.keys(additionalFields).length > 0 && (
              <div style={{background: '#fff7ed', padding: 16, borderRadius: 8, marginBottom: 20, border: '2px solid #fb923c'}}>
                <h4 style={{margin: '0 0 16px 0', color: '#ea580c', display: 'flex', alignItems: 'center', gap: 8}}>
                  <AlertTriangle size={18} />
                  Additional Required Fields for "{form.service_offering}"
                </h4>
                
                <div style={S.formGrid}>
                  {Object.entries(additionalFields).map(([fieldName, fieldInfo]) => (
                    <div key={fieldName} style={S.formGroup}>
                      <label style={S.formLabel}>
                        {fieldInfo.label || fieldName.replace(/_/g, ' ')} *
                      </label>
                      <input 
                        style={S.input}
                        value={form[fieldName] || ''}
                        onChange={(e) => setForm(p => ({...p, [fieldName]: e.target.value}))}
                        required
                        placeholder={fieldInfo.placeholder || `Enter ${fieldName.replace(/_/g, ' ')}`}
                      />
                      {fieldInfo.description && (
                        <small style={{color: '#64748b', marginTop: 4}}>{fieldInfo.description}</small>
                      )}
                    </div>
                  ))}
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
                onClick={save}
              >
                {editingItem ? 'Update Mapping' : 'Create Mapping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mappings.length === 0 ? (
        <div style={{...S.noItems, background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', border: '2px dashed #cbd5e1'}}>
          <h3 style={{color: '#475569'}}>No System Mappings Found</h3>
          <p style={{color: '#64748b'}}>Create your first system mapping to define base incident settings for applications.</p>
          <div style={{marginTop: 16, fontSize: 14, color: '#64748b'}}>
            💡 <strong>How it works:</strong> Each Grafana application gets mapped to ServiceNow incident fields
          </div>
        </div>
      ) : (
        <div>
          <h3 style={{color: '#1e293b', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8}}>
            <Settings size={20} />
            System Mappings ({mappings.length})
          </h3>
          
          {mappings.map((m) => (
            <div key={m._id} style={{...S.card(), background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)', border: '2px solid #eab308'}}>
              <div style={S.cardHeader}>
                <div>
                  <div style={{...S.cardTitle, display: 'flex', alignItems: 'center', gap: 8}}>
                    📊 Application: "{m.grafana_name}"
                  </div>
                  <div style={S.cardSubtitle}>Base mapping for all incidents from this application</div>
                </div>
                <div>
                  <button 
                    style={{...S.buttonSecondary, display: 'inline-flex', alignItems: 'center', gap: 6}} 
                    onClick={() => startEdit(m)}
                  >
                    <Edit size={14} />
                    Edit
                  </button>
                  <button 
                    style={{...S.buttonDanger, display: 'inline-flex', alignItems: 'center', gap: 6}} 
                    onClick={() => del(m._id)}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>

              {/* Visual mapping flow */}
              <div style={{background: 'white', padding: 16, borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12}}>
                  <div style={{...S.pill('#3b82f6'), fontWeight: 600}}>
                    WHEN Alert from "{m.grafana_name}"
                  </div>
                  <ArrowRight size={16} color="#64748b" />
                  <div style={{...S.pill('#10b981'), fontWeight: 600}}>
                    CREATE Incident with these settings
                  </div>
                </div>
              </div>

              <div style={S.grid('repeat(auto-fit, minmax(250px, 1fr))')}>
                <div style={S.kvBox}>
                  <div style={S.kvKey}>Assignment Group</div>
                  <div style={S.kvVal}>{m.assignment_group}</div>
                </div>
                <div style={S.kvBox}>
                  <div style={S.kvKey}>Service Offering</div>
                  <div style={S.kvVal}>{m.service_offering}</div>
                </div>
                <div style={S.kvBox}>
                  <div style={S.kvKey}>Business Service</div>
                  <div style={S.kvVal}>{m.business_service}</div>
                </div>
                <div style={S.kvBox}>
                  <div style={S.kvKey}>Site</div>
                  <div style={S.kvVal}>{m.u_site}</div>
                </div>
                <div style={S.kvBox}>
                  <div style={S.kvKey}>Network</div>
                  <div style={S.kvVal}>{m.u_network}</div>
                </div>
                <div style={S.kvBox}>
                  <div style={S.kvKey}>Impact Technology</div>
                  <div style={S.kvVal}>{m.u_impact_technology}</div>
                </div>
              </div>

              {/* Show additional fields if any */}
              {Object.keys(m).filter(k => !['_id', 'grafana_name', 'service_offering', 'business_service', 'u_site', 'u_network', 'u_impact_technology', 'assignment_group', 'created_at', 'updated_at'].includes(k)).length > 0 && (
                <div style={{marginTop: 16, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #fb923c'}}>
                  <div style={{fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 8}}>Additional ServiceNow Fields:</div>
                  <div style={S.grid('repeat(auto-fit, minmax(200px, 1fr))')}>
                    {Object.entries(m)
                      .filter(([k]) => !['_id', 'grafana_name', 'service_offering', 'business_service', 'u_site', 'u_network', 'u_impact_technology', 'assignment_group', 'created_at', 'updated_at'].includes(k))
                      .map(([k, v]) => (
                        <div key={k} style={{...S.kvBox, background: 'white', border: '1px solid #fed7aa'}}>
                          <div style={S.kvKey}>{k.replace(/_/g, ' ')}</div>
                          <div style={S.kvVal}>{v}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {m.created_at && (
                <div style={S.metaRow}>
                  Created: {new Date(m.created_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncidentMappings;