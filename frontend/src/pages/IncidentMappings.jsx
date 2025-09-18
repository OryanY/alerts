import React, { useEffect, useState } from 'react';
import { Settings, Plus, Edit, Trash2, RefreshCw, CheckCircle, AlertTriangle, X } from 'lucide-react';

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
    system_failure: false, // New mandatory field
  });

  const baseMandatoryFields = [
    'service_offering',
    'business_service', 
    'u_network',
    'u_impact_technology',
    'assignment_group',
    'system_failure'
  ];

  const reset = () => {
    setForm({
      grafana_name: '',
      service_offering: '',
      business_service: '',
      u_network: '',
      u_impact_technology: '',
      assignment_group: '',
      system_failure: false,
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
      u_network: m.u_network || '',
      u_impact_technology: m.u_impact_technology || '',
      assignment_group: m.assignment_group || '',
      system_failure: Boolean(m.system_failure), // Handle boolean
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
    
    if (m.service_offering) {
      fetchAdditionalFields(m.service_offering);
    }

    // Scroll to form
    setTimeout(() => {
      document.getElementById('mapping-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
          <div style={{fontSize: 14, color: '#64748b', marginTop: 8}}>This might take a moment</div>
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
            <div style={{fontWeight: 600, color: '#dc2626', marginBottom: 4}}>Oops! Something went wrong</div>
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
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
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
            onMouseOver={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.color = '#3b82f6';
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
          {/* Decorative header */}
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
              {editingItem ? 'Update Your Mapping' : 'Create New Mapping'}
            </h3>
            <p style={{
              margin: 0, 
              color: '#64748b', 
              fontSize: 16,
              marginBottom: 32
            }}>
              {editingItem 
                ? 'Make changes to how this app creates incidents' 
                : 'Set up how alerts from this app should create ServiceNow incidents'
              }
            </p>

            <form onSubmit={save} style={{display: 'flex', flexDirection: 'column', gap: 32}}>
              {/* App Name Section */}
              <div style={{
                background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                padding: 24,
                borderRadius: 12,
                border: '2px solid #0ea5e9'
              }}>
                <h4 style={{
                  margin: '0 0 16px 0', 
                  fontSize: 18, 
                  fontWeight: 600,
                  color: '#0c4a6e',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8
                }}>
                  🎯 Which Grafana App?
                </h4>
                <input 
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #bae6fd',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 500,
                    background: 'white',
                    color: '#0c4a6e'
                  }}
                  value={form.grafana_name} 
                  onChange={(e) => setForm(p => ({...p, grafana_name: e.target.value}))} 
                  required 
                  placeholder="Type the exact app name from Grafana (e.g., eck, prometheus)" 
                />
                <p style={{margin: '8px 0 0 0', fontSize: 14, color: '#0369a1'}}>
                  💡 This must match exactly what appears in your Grafana alerts
                </p>
              </div>

              {/* Service Info */}
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
                  color: '#92400e',
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8
                }}>
                  🏢 Service Details
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
                  onChange={(e) => {
                    setForm(p => ({...p, service_offering: e.target.value}));
                    fetchAdditionalFields(e.target.value);
                  }}
                  required 
                  placeholder="What service does this app provide? (e.g., Elasticsearch - ECK)"
                />
                {loadingFields && (
                  <p style={{margin: '8px 0 0 0', fontSize: 14, color: '#d97706'}}>
                    🔄 Checking for additional required fields...
                  </p>
                )}
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
                  Required Information
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
                      placeholder="e.g., Network A" 
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
                        checked={form.system_failure}
                        onChange={(e) => setForm(p => ({...p, system_failure: e.target.checked}))}
                        style={{
                          width: 18,
                          height: 18,
                          accentColor: '#22c55e'
                        }}
                      />
                      System Failure?
                    </label>
                    <p style={{margin: '4px 0 0 30px', fontSize: 12, color: '#15803d'}}>
                      Check if this represents a system failure
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Fields */}
              {Object.keys(additionalFields).length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                  padding: 24,
                  borderRadius: 12,
                  border: '2px solid #fb923c'
                }}>
                  <h4 style={{
                    margin: '0 0 16px 0', 
                    fontSize: 18, 
                    fontWeight: 600,
                    color: '#ea580c',
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8
                  }}>
                    <AlertTriangle size={20} />
                    Extra Fields for "{form.service_offering}"
                  </h4>
                  
                  <div style={{
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                    gap: 20
                  }}>
                    {Object.entries(additionalFields).map(([fieldName, fieldInfo]) => (
                      <div key={fieldName}>
                        <label style={{
                          display: 'block',
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#ea580c',
                          marginBottom: 8
                        }}>
                          {fieldInfo.label || fieldName.replace(/_/g, ' ')} *
                        </label>
                        <input 
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            border: '2px solid #fed7aa',
                            borderRadius: 6,
                            fontSize: 14,
                            background: 'white'
                          }}
                          value={form[fieldName] || ''}
                          onChange={(e) => setForm(p => ({...p, [fieldName]: e.target.value}))}
                          required
                          placeholder={fieldInfo.placeholder || `Enter ${fieldName.replace(/_/g, ' ')}`}
                        />
                        {fieldInfo.description && (
                          <p style={{margin: '4px 0 0 0', fontSize: 12, color: '#c2410c'}}>
                            {fieldInfo.description}
                          </p>
                        )}
                      </div>
                    ))}
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
                    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 32px',
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
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
            Create your first system mapping to tell us how Grafana alerts should create ServiceNow incidents.
          </p>
          <div style={{
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            padding: 16,
            borderRadius: 8,
            fontSize: 14,
            color: '#1e40af',
            maxWidth: 400,
            margin: '0 auto'
          }}>
            💡 <strong>How it works:</strong> Each Grafana app gets its own incident settings
          </div>
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
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              Your Mappings ({mappings.length})
            </h3>
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
            {mappings.map((m) => (
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
                      margin: '0 0 8px 0',
                      fontSize: 20,
                      fontWeight: 700,
                      color: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      📊 {m.grafana_name}
                      {m.system_failure && (
                        <span style={{
                          background: '#fecaca',
                          color: '#dc2626',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600
                        }}>
                          SYSTEM FAILURE
                        </span>
                      )}
                    </h4>
                    <p style={{margin: 0, color: '#64748b', fontSize: 14}}>
                      Alerts from this app will create incidents with these settings
                    </p>
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

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 16
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
                      {m.assignment_group}
                    </div>
                  </div>

                  <div style={{
                    background: '#f8fafc',
                    padding: 16,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0'
                  }}>
                    <div style={{fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4}}>
                      Service Offering
                    </div>
                    <div style={{fontSize: 14, fontWeight: 600, color: '#1e293b'}}>
                      {m.service_offering}
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

                {/* Show additional fields if any */}
                {Object.keys(m).filter(k => !['_id', 'grafana_name', 'service_offering', 'business_service', 'u_network', 'u_impact_technology', 'assignment_group', 'system_failure', 'created_at', 'updated_at'].includes(k)).length > 0 && (
                  <div style={{
                    marginTop: 16,
                    padding: 16,
                    background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                    borderRadius: 8,
                    border: '1px solid #fb923c'
                  }}>
                    <div style={{fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 12}}>
                      Additional ServiceNow Fields:
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: 12
                    }}>
                      {Object.entries(m)
                        .filter(([k]) => !['_id', 'grafana_name', 'service_offering', 'business_service', 'u_network', 'u_impact_technology', 'assignment_group', 'system_failure', 'created_at', 'updated_at'].includes(k))
                        .map(([k, v]) => (
                          <div key={k} style={{
                            background: 'white',
                            padding: 12,
                            borderRadius: 6,
                            border: '1px solid #fed7aa'
                          }}>
                            <div style={{fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 4}}>
                              {k.replace(/_/g, ' ')}
                            </div>
                            <div style={{fontSize: 14, color: '#9a3412'}}>
                              {v}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {m.created_at && (
                  <div style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: '1px solid #f1f5f9',
                    fontSize: 12,
                    color: '#94a3b8'
                  }}>
                    Created: {new Date(m.created_at).toLocaleString()}
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

export default IncidentMappings;