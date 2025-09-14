import React, { useState, useEffect } from 'react';

const IncidentManagement = () => {
  const [activeTab, setActiveTab] = useState('mappings'); // 'mappings' or 'rules'
  const [mappings, setMappings] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [dropdowns, setDropdowns] = useState({ u_monitor_identifier: [], u_impact_technology: [] });
  
  // Form data for system mappings
  const [mappingFormData, setMappingFormData] = useState({
    grafana_name: '',
    service_offering: '',
    business_service: '',
    u_site: '',
    u_network: '',
    u_impact_technology: '',
    connection_string: '',
    assignment_group: '',
    u_monitor_identifier: 'עלה בניטור'
  });

  // Form data for incident rules
  const [ruleFormData, setRuleFormData] = useState({
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

  // Helper: current mapping selected in rule form
  const selectedMapping = React.useMemo(() => {
    try {
      return mappings.find(m => String(m._id) === String(ruleFormData.system_mapping_id));
    } catch {
      return undefined;
    }
  }, [mappings, ruleFormData.system_mapping_id]);

  const API_BASE = '/api/incidents';

  // Fetch system mappings
  const fetchMappings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/system-mappings`);
      const data = await response.json();
      
      if (data.success) {
        setMappings(data.data || []);
      } else {
        setError('Failed to fetch system mappings');
      }
    } catch (err) {
      setError('Error connecting to server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch incident rules
  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/incident-rules`);
      const data = await response.json();
      
      if (data.success) {
        setRules(data.data || []);
      } else {
        setError('Failed to fetch incident rules');
      }
    } catch (err) {
      setError('Error connecting to server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save system mapping
  const saveMapping = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingItem && activeTab === 'mappings'
        ? `${API_BASE}/system-mappings/${editingItem._id}`
        : `${API_BASE}/system-mappings`;
      
      const method = editingItem && activeTab === 'mappings' ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingFormData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchMappings();
        resetForm();
        setShowForm(false);
      } else {
        setError(data.details || 'Failed to save mapping');
      }
    } catch (err) {
      setError('Error saving mapping: ' + err.message);
    }
  };

  // Save incident rule
  const saveRule = async (e) => {
    e.preventDefault();
    
    try {
      // Clean up conditions - remove empty arrays and strings
      const cleanConditions = {};
      Object.entries(ruleFormData.conditions).forEach(([key, value]) => {
        if (Array.isArray(value) && value.length > 0) {
          cleanConditions[key] = value;
        } else if (typeof value === 'string' && value.trim()) {
          cleanConditions[key] = value.trim();
        }
      });

      // Clean up overrides
      const cleanOverrides = {};
      Object.entries(ruleFormData.incident_overrides).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          cleanOverrides[key] = value.trim();
        }
      });

      const ruleData = {
        ...ruleFormData,
        conditions: cleanConditions,
        incident_overrides: Object.keys(cleanOverrides).length > 0 ? cleanOverrides : undefined
      };

      const url = editingItem && activeTab === 'rules'
        ? `${API_BASE}/incident-rules/${editingItem._id}`
        : `${API_BASE}/incident-rules`;
      
      const method = editingItem && activeTab === 'rules' ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchRules();
        resetForm();
        setShowForm(false);
      } else {
        setError(data.details || 'Failed to save rule');
      }
    } catch (err) {
      setError('Error saving rule: ' + err.message);
    }
  };

  // Delete mapping
  const deleteMapping = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/system-mappings/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchMappings();
      } else {
        setError(data.details || 'Failed to delete mapping');
      }
    } catch (err) {
      setError('Error deleting mapping: ' + err.message);
    }
  };

  // Delete rule
  const deleteRule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/incident-rules/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchRules();
      } else {
        setError(data.details || 'Failed to delete rule');
      }
    } catch (err) {
      setError('Error deleting rule: ' + err.message);
    }
  };

  // Toggle rule enabled/disabled
  const toggleRule = async (id, enabled) => {
    try {
      const response = await fetch(`${API_BASE}/incident-rules/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchRules();
      } else {
        setError(data.details || 'Failed to toggle rule');
      }
    } catch (err) {
      setError('Error toggling rule: ' + err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setMappingFormData({
      grafana_name: '',
      service_offering: '',
      business_service: '',
      u_site: '',
      u_network: '',
      u_impact_technology: '',
      connection_string: '',
      assignment_group: '',
      u_monitor_identifier: 'עלה בניטור'
    });
    
    setRuleFormData({
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
  };

  // Start editing mapping
  const startEditMapping = (mapping) => {
    setMappingFormData({
      grafana_name: mapping.grafana_name || '',
      service_offering: mapping.service_offering || '',
      business_service: mapping.business_service || '',
      u_site: mapping.u_site || '',
      u_network: mapping.u_network || '',
      u_impact_technology: mapping.u_impact_technology || '',
      connection_string: mapping.connection_string || '',
      assignment_group: mapping.assignment_group || '',
      u_monitor_identifier: mapping.u_monitor_identifier || 'עלה בניטור'
    });
    setEditingItem(mapping);
    setActiveTab('mappings');
    setShowForm(true);
  };

  // Start editing rule
  const startEditRule = (rule) => {
    setRuleFormData({
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
    setActiveTab('rules');
    setShowForm(true);
  };

  // Handle input changes for arrays (tags)
  const handleArrayInput = (field, value, formType = 'rule') => {
    const items = value.split(',').map(item => item.trim()).filter(item => item);
    
    if (formType === 'rule') {
      setRuleFormData(prev => ({
        ...prev,
        conditions: {
          ...prev.conditions,
          [field]: items
        }
      }));
    }
  };

  useEffect(() => {
    fetchMappings();
    fetchRules();
    // Load dropdown options for mapping fields
    const loadDropdowns = async () => {
      try {
        const [monRes, impRes] = await Promise.all([
          fetch(`${API_BASE}/dropdown-options/u_monitor_identifier`),
          fetch(`${API_BASE}/dropdown-options/u_impact_technology`)
        ]);
        const [mon, imp] = await Promise.all([monRes.json(), impRes.json()]);
        setDropdowns({
          u_monitor_identifier: mon?.data || [],
          u_impact_technology: imp?.data || []
        });
      } catch (e) {
        // Non-fatal; keep inputs usable as text if fetch fails (but we're using selects)
        console.warn('Failed to load dropdown options', e);
      }
    };
    loadDropdowns();
  }, []);

  const styles = {
    container: {
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    },
    header: {
      backgroundColor: '#f5f5f5',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      borderLeft: '4px solid #007bff'
    },
    title: {
      margin: '0 0 10px 0',
      color: '#333',
      fontSize: '24px'
    },
    subtitle: {
      margin: 0,
      color: '#666',
      fontSize: '14px'
    },
    tabs: {
      display: 'flex',
      marginBottom: '20px',
      borderBottom: '2px solid #e9ecef'
    },
    tab: {
      padding: '12px 24px',
      backgroundColor: 'transparent',
      border: 'none',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: 'bold',
      borderBottom: '3px solid transparent',
      transition: 'all 0.3s ease'
    },
    activeTab: {
      color: '#007bff',
      borderBottomColor: '#007bff'
    },
    inactiveTab: {
      color: '#666',
      borderBottomColor: 'transparent'
    },
    button: {
      backgroundColor: '#007bff',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      marginRight: '10px',
      marginBottom: '10px'
    },
    buttonSecondary: {
      backgroundColor: '#6c757d',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      marginRight: '5px'
    },
    buttonDanger: {
      backgroundColor: '#dc3545',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      marginLeft: '5px'
    },
    buttonSuccess: {
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
      marginRight: '5px'
    },
    buttonDisabled: {
      backgroundColor: '#6c757d',
      opacity: 0.6,
      cursor: 'not-allowed'
    },
    error: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '20px',
      border: '1px solid #f5c6cb'
    },
    loading: {
      textAlign: 'center',
      padding: '40px',
      color: '#666'
    },
    card: {
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px',
      paddingBottom: '10px',
      borderBottom: '2px solid #e9ecef'
    },
    ruleHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '15px'
    },
    ruleTitle: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#007bff',
      margin: 0
    },
    ruleSubtitle: {
      fontSize: '14px',
      color: '#666',
      margin: '5px 0'
    },
    ruleStatus: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    statusBadge: {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold'
    },
    enabledBadge: {
      backgroundColor: '#d4edda',
      color: '#155724',
      border: '1px solid #c3e6cb'
    },
    disabledBadge: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      border: '1px solid #f5c6cb'
    },
    conditionsSection: {
      backgroundColor: '#e7f3ff',
      padding: '15px',
      borderRadius: '4px',
      marginBottom: '15px'
    },
    overridesSection: {
      backgroundColor: '#fff3cd',
      padding: '15px',
      borderRadius: '4px',
      marginBottom: '15px'
    },
    sectionTitle: {
      fontSize: '14px',
      fontWeight: 'bold',
      marginBottom: '10px',
      color: '#495057'
    },
    conditionItem: {
      marginBottom: '8px',
      fontSize: '13px'
    },
    conditionLabel: {
      fontWeight: 'bold',
      color: '#004085'
    },
    conditionValue: {
      color: '#004085',
      fontFamily: 'monospace',
      backgroundColor: 'white',
      padding: '2px 6px',
      borderRadius: '3px',
      border: '1px solid #b3d9ff'
    },
    form: {
      backgroundColor: 'white',
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px'
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '15px',
      marginBottom: '20px'
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column'
    },
    formLabel: {
      marginBottom: '5px',
      fontWeight: 'bold',
      color: '#495057'
    },
    formInput: {
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '14px'
    },
    textarea: {
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '14px',
      minHeight: '100px',
      resize: 'vertical'
    },
    formActions: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'flex-end'
    },
    noItems: {
      textAlign: 'center',
      padding: '40px',
      color: '#666',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px'
    },
    tagInput: {
      fontSize: '13px',
      color: '#666',
      marginTop: '5px'
    },
    priorityIndicator: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 'bold',
      backgroundColor: '#17a2b8',
      color: 'white',
      marginLeft: '10px'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading incident management...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Enhanced Incident Management</h1>
        <p style={styles.subtitle}>
          Configure system mappings and create specific rules for different alert types. 
          Rules allow conditional incident creation based on message content, node names, and other criteria.
        </p>
      </div>

      {error && (
        <div style={styles.error}>
          <strong>Error:</strong> {error}
          <button 
            style={{...styles.buttonSecondary, float: 'right', marginTop: '-5px'}}
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button 
          style={{
            ...styles.tab,
            ...(activeTab === 'mappings' ? styles.activeTab : styles.inactiveTab)
          }}
          onClick={() => {
            setActiveTab('mappings');
            setShowForm(false);
            resetForm();
          }}
        >
          System Mappings ({mappings.length})
        </button>
        <button 
          style={{
            ...styles.tab,
            ...(activeTab === 'rules' ? styles.activeTab : styles.inactiveTab)
          }}
          onClick={() => {
            setActiveTab('rules');
            setShowForm(false);
            resetForm();
          }}
        >
          Incident Rules ({rules.length})
        </button>
      </div>

      {/* Action Buttons */}
      <div>
        <button 
          style={styles.button}
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? 'Cancel' : `Add New ${activeTab === 'mappings' ? 'Mapping' : 'Rule'}`}
        </button>
        
        <button 
          style={styles.buttonSecondary}
          onClick={activeTab === 'mappings' ? fetchMappings : fetchRules}
        >
          Refresh
        </button>
      </div>

      {/* Forms */}
      {showForm && activeTab === 'mappings' && (
        <div style={styles.form}>
          <h3>{editingItem ? 'Edit System Mapping' : 'Create New System Mapping'}</h3>
          <form onSubmit={saveMapping}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Grafana Application Name *</label>
                <input
                  type="text"
                  name="grafana_name"
                  value={mappingFormData.grafana_name}
                  onChange={(e) => setMappingFormData(prev => ({...prev, grafana_name: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., eck"
                />
                <datalist id="impact-tech-list">
                  {dropdowns.u_impact_technology.map((opt) => (
                    <option key={`impact-${opt}`} value={opt} />
                  ))}
                </datalist>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Service Offering *</label>
                <input
                  type="text"
                  name="service_offering"
                  value={mappingFormData.service_offering}
                  onChange={(e) => setMappingFormData(prev => ({...prev, service_offering: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., Elastic - eck"
                />
                <datalist id="monitor-id-list">
                  {dropdowns.u_monitor_identifier.map((opt) => (
                    <option key={`mon-${opt}`} value={opt} />
                  ))}
                </datalist>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Business Service *</label>
                <input
                  type="text"
                  name="business_service"
                  value={mappingFormData.business_service}
                  onChange={(e) => setMappingFormData(prev => ({...prev, business_service: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., מאגר מידע"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Site *</label>
                <input
                  type="text"
                  name="u_site"
                  value={mappingFormData.u_site}
                  onChange={(e) => setMappingFormData(prev => ({...prev, u_site: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., ראשי"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Network *</label>
                <input
                  type="text"
                  name="u_network"
                  value={mappingFormData.u_network}
                  onChange={(e) => setMappingFormData(prev => ({...prev, u_network: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., רשתא"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Impact Technology *</label>
                <input
                  type="text"
                  name="u_impact_technology"
                  list="impact-tech-list"
                  value={mappingFormData.u_impact_technology}
                  onChange={(e) => setMappingFormData(prev => ({...prev, u_impact_technology: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., ירידה משרידות"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Assignment Group *</label>
                <input
                  type="text"
                  name="assignment_group"
                  value={mappingFormData.assignment_group}
                  onChange={(e) => setMappingFormData(prev => ({...prev, assignment_group: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., צוות מאגרים"
                />
              </div>
            

              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Monitor Identifier</label>
                <input
                  type="text"
                  name="u_monitor_identifier"
                  list="monitor-id-list"
                  value={mappingFormData.u_monitor_identifier}
                  onChange={(e) => setMappingFormData(prev => ({...prev, u_monitor_identifier: e.target.value}))}
                  style={styles.formInput}
                  placeholder="'עלה בניטור'"
                />
              </div>
            </div>
            
            <div style={styles.formActions}>
              <button 
                type="button" 
                style={styles.buttonSecondary}
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" style={styles.button}>
                {editingItem ? 'Update Mapping' : 'Create Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && activeTab === 'rules' && (
        <div style={styles.form}>
          <h3>{editingItem ? 'Edit Incident Rule' : 'Create New Incident Rule'}</h3>
          <form onSubmit={saveRule}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>System Mapping *</label>
                <select
                  value={ruleFormData.system_mapping_id}
                  onChange={(e) => setRuleFormData(prev => ({...prev, system_mapping_id: e.target.value}))}
                  style={styles.formInput}
                  required
                >
                  <option value="">Select system mapping</option>
                  {mappings.map(mapping => (
                    <option key={mapping._id} value={mapping._id}>
                      {mapping.grafana_name} - {mapping.service_offering}
                    </option>
                  ))}
                </select>
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Rule Name *</label>
                <input
                  type="text"
                  value={ruleFormData.rule_name}
                  onChange={(e) => setRuleFormData(prev => ({...prev, rule_name: e.target.value}))}
                  style={styles.formInput}
                  required
                  placeholder="e.g., ECK High CPU Usage"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description</label>
                <input
                  type="text"
                  value={ruleFormData.description}
                  onChange={(e) => setRuleFormData(prev => ({...prev, description: e.target.value}))}
                  style={styles.formInput}
                  placeholder="Describe when this rule should trigger"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Priority Order</label>
                <input
                  type="number"
                  min="1"
                  value={ruleFormData.priority_order}
                  onChange={(e) => setRuleFormData(prev => ({...prev, priority_order: parseInt(e.target.value) || 1}))}
                  style={styles.formInput}
                  placeholder="1"
                />
                <small style={styles.tagInput}>Higher numbers have higher priority</small>
              </div>
            </div>

            {/* Conditions Section */}
            <div style={{...styles.conditionsSection, marginBottom: '20px'}}>
              <h4 style={styles.sectionTitle}>Alert Matching Conditions (at least one required)</h4>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Message Contains (OR logic)</label>
                  <input
                    type="text"
                    value={ruleFormData.conditions.message_contains.join(', ')}
                    onChange={(e) => handleArrayInput('message_contains', e.target.value)}
                    style={styles.formInput}
                    placeholder="CPU, memory, disk"
                  />
                  <small style={styles.tagInput}>Comma-separated values. Alert matches if message contains ANY of these.</small>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Message Regex Pattern</label>
                  <input
                    type="text"
                    value={ruleFormData.conditions.message_regex}
                    onChange={(e) => setRuleFormData(prev => ({
                      ...prev,
                      conditions: {...prev.conditions, message_regex: e.target.value}
                    }))}
                    style={styles.formInput}
                    placeholder="/CPU.*high|high.*CPU/i"
                  />
                  <small style={styles.tagInput}>Regular expression for complex matching</small>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Message Exact Match</label>
                  <input
                    type="text"
                    value={ruleFormData.conditions.message_exact}
                    onChange={(e) => setRuleFormData(prev => ({
                      ...prev,
                      conditions: {...prev.conditions, message_exact: e.target.value}
                    }))}
                    style={styles.formInput}
                    placeholder="Exact message text"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Node Name Contains</label>
                  <input
                    type="text"
                    value={ruleFormData.conditions.node_name_contains.join(', ')}
                    onChange={(e) => handleArrayInput('node_name_contains', e.target.value)}
                    style={styles.formInput}
                    placeholder="prod, staging, worker"
                  />
                  <small style={styles.tagInput}>Comma-separated values</small>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Object Name Contains</label>
                  <input
                    type="text"
                    value={ruleFormData.conditions.object_name_contains.join(', ')}
                    onChange={(e) => handleArrayInput('object_name_contains', e.target.value)}
                    style={styles.formInput}
                    placeholder="elasticsearch, kibana, beats"
                  />
                  <small style={styles.tagInput}>Comma-separated values</small>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Network</label>
                  <input
                    type="text"
                    value={ruleFormData.conditions.network}
                    onChange={(e) => setRuleFormData(prev => ({
                      ...prev,
                      conditions: {...prev.conditions, network: e.target.value}
                    }))}
                    style={styles.formInput}
                    placeholder="prod-net, staging-net"
                  />
                  <small style={styles.tagInput}>Match specific network from alert</small>
                </div>
              </div>
            </div>

            {/* Incident Overrides Section (allow overrides for mapping fields except service_offering, business_service, grafana_name, enabled) */}
            <div style={{...styles.overridesSection, marginBottom: '20px'}}>
              <h4 style={styles.sectionTitle}>Incident Field Overrides (optional)</h4>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Short Description Template</label>
                  <input
                    type="text"
                    value={ruleFormData.incident_overrides.short_description}
                    onChange={(e) => setRuleFormData(prev => ({
                      ...prev,
                      incident_overrides: {...prev.incident_overrides, short_description: e.target.value}
                    }))}
                    style={styles.formInput}
                    placeholder="High CPU Alert: {{object_name}} on {{node_name}}"
                  />
                  <small style={styles.tagInput}>Use {} for variables: application, object_name, node_name, message, network, time_created, operator</small>
                </div>

            {(() => {
                  // Exclude system fields that shouldn't be overridden
                  const exclude = new Set(['_id','grafana_name','service_offering','business_service','enabled','created_at','updated_at']);
                  const k2label = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  
                  if (!selectedMapping) {
                    return (
                      <div style={{...styles.formGroup, gridColumn: '1 / -1'}}>
                        <div style={{textAlign: 'center', color: '#666', fontStyle: 'italic'}}>
                          Select a system mapping to see available field overrides
                        </div>
                      </div>
                    );
                  }
                  
                  const keys = Object.keys(selectedMapping).filter(k => !exclude.has(k));
                  
                  return keys.map((k) => (
                    <div key={k} style={styles.formGroup}>
                      <label style={styles.formLabel}>
                        {k2label(k)} Override
                        {['service_offering', 'business_service'].includes(k) && 
                          <span style={{color: '#dc3545', fontSize: '12px'}}> (Core Field - Use Carefully)</span>
                        }
                      </label>
                      {(k === 'u_impact_technology' || k === 'u_monitor_identifier') ? (
                        <select
                          value={ruleFormData.incident_overrides[k] ?? ''}
                          onChange={(e) => setRuleFormData(prev => ({
                            ...prev,
                            incident_overrides: { ...prev.incident_overrides, [k]: e.target.value }
                          }))}
                          style={styles.formInput}
                        >
                          <option value="">Select {k2label(k).toLowerCase()}</option>
                          {(k === 'u_impact_technology' ? dropdowns.u_impact_technology : dropdowns.u_monitor_identifier).map((opt) => (
                            <option key={`${k}-${opt}`} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={ruleFormData.incident_overrides[k] ?? ''}
                          onChange={(e) => setRuleFormData(prev => ({
                            ...prev,
                            incident_overrides: { ...prev.incident_overrides, [k]: e.target.value }
                          }))}
                          style={styles.formInput}
                          placeholder={`Override ${k2label(k).toLowerCase()}...`}
                        />
                      )}
                      <small style={styles.tagInput}>
                        Base mapping value: <strong>{selectedMapping[k] != null ? String(selectedMapping[k]) : '—'}</strong>
                      </small>
                    </div>
                  ));
                })()}
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description Template</label>
                <textarea
                  value={ruleFormData.incident_overrides.description}
                  onChange={(e) => setRuleFormData(prev => ({
                    ...prev,
                    incident_overrides: {...prev.incident_overrides, description: e.target.value}
                  }))}
                  style={styles.textarea}
                  placeholder={`Custom incident description template:

Application: {{application}}
Object: {{object_name}}
Node: {{node_name}}
Network: {{network}}
Message: {{message}}
Time: {{time_created}}

Please investigate and take appropriate action.`}
                />
                <small style={styles.tagInput}>Use '{}' for template variables</small>
              </div>
            </div>
            
            <div style={styles.formActions}>
              <button 
                type="button" 
                style={styles.buttonSecondary}
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </button>
              <button type="submit" style={styles.button}>
                {editingItem ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
                    </div>  
          </form>
        </div>
      )}

      {/* Content Based on Active Tab */}
      {activeTab === 'mappings' && (
        <div>
          {mappings.length === 0 ? (
            <div style={styles.noItems}>
              <h3>No System Mappings Found</h3>
              <p>Create your first system mapping to define base incident settings for applications.</p>
            </div>
          ) : (
            <div>
              <h3>System Mappings ({mappings.length})</h3>
              {mappings.map((mapping) => (
                <div key={mapping._id} style={styles.card}>
                  <div style={styles.cardHeader}>
                    <div>
                      <div style={{fontSize: '18px', fontWeight: 'bold', color: '#007bff'}}>
                        Application: "{mapping.grafana_name}"
                      </div>
                      <div style={{fontSize: '14px', color: '#666', marginTop: '5px'}}>
                        Base mapping for all incidents from this application
                      </div>
                    </div>
                    <div>
                      <button 
                        style={styles.buttonSecondary}
                        onClick={() => startEditMapping(mapping)}
                      >
                        Edit
                      </button>
                      <button 
                        style={styles.buttonDanger}
                        onClick={() => deleteMapping(mapping._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '10px',
                    marginBottom: '15px'
                  }}>
                    <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '14px'}}>
                      <div style={{fontWeight: 'bold', color: '#495057', marginBottom: '2px'}}>Assignment Group:</div>
                      <div style={{color: '#6c757d'}}>{mapping.assignment_group}</div>
                    </div>
                    
                    <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '14px'}}>
                      <div style={{fontWeight: 'bold', color: '#495057', marginBottom: '2px'}}>Service Offering:</div>
                      <div style={{color: '#6c757d'}}>{mapping.service_offering}</div>
                    </div>
                    
                    <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '14px'}}>
                      <div style={{fontWeight: 'bold', color: '#495057', marginBottom: '2px'}}>Business Service:</div>
                      <div style={{color: '#6c757d'}}>{mapping.business_service}</div>
                    </div>
                    
                    <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '14px'}}>
                      <div style={{fontWeight: 'bold', color: '#495057', marginBottom: '2px'}}>Site:</div>
                      <div style={{color: '#6c757d'}}>{mapping.u_site}</div>
                    </div>
                    
                    <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '14px'}}>
                      <div style={{fontWeight: 'bold', color: '#495057', marginBottom: '2px'}}>Network:</div>
                      <div style={{color: '#6c757d'}}>{mapping.u_network}</div>
                    </div>
                    
                    <div style={{padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '14px'}}>
                      <div style={{fontWeight: 'bold', color: '#495057', marginBottom: '2px'}}>Impact Technology:</div>
                      <div style={{color: '#6c757d'}}>{mapping.u_impact_technology}</div>
                    </div>

    
                  </div>

                  {mapping.created_at && (
                    <div style={{fontSize: '12px', color: '#666', marginTop: '10px'}}>
                      Created: {new Date(mapping.created_at).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'rules' && (
        <div>
          {rules.length === 0 ? (
            <div style={styles.noItems}>
              <h3>No Incident Rules Found</h3>
              <p>Create incident rules to handle specific alert types with custom conditions and incident settings.</p>
              {mappings.length === 0 && (
                <p><strong>Note:</strong> You need to create system mappings first before creating rules.</p>
              )}
            </div>
          ) : (
            <div>
              <h3>Incident Rules ({rules.length})</h3>
              {rules.map((rule) => (
                <div key={rule._id} style={styles.card}>
                  <div style={styles.ruleHeader}>
                    <div style={{flex: 1}}>
                      <div style={styles.ruleTitle}>
                        {rule.rule_name}
                        <span style={styles.priorityIndicator}>Priority {rule.priority_order}</span>
                      </div>
                      <div style={styles.ruleSubtitle}>
                        Application: {rule.grafana_name} | 
                        {rule.system_mapping ? ` Service: ${rule.system_mapping.service_offering}` : ' System mapping not found'}
                      </div>
                      {rule.description && (
                        <div style={{fontSize: '13px', color: '#666', marginTop: '5px'}}>
                          {rule.description}
                        </div>
                      )}
                    </div>
                    <div style={styles.ruleStatus}>
                      <span style={{
                        ...styles.statusBadge,
                        ...(rule.enabled ? styles.enabledBadge : styles.disabledBadge)
                      }}>
                        {rule.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                      <button 
                        style={{
                          ...(rule.enabled ? styles.buttonSecondary : styles.buttonSuccess),
                          fontSize: '11px',
                          padding: '4px 8px'
                        }}
                        onClick={() => toggleRule(rule._id, !rule.enabled)}
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button 
                        style={styles.buttonSecondary}
                        onClick={() => startEditRule(rule)}
                      >
                        Edit
                      </button>
                      <button 
                        style={styles.buttonDanger}
                        onClick={() => deleteRule(rule._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Conditions Section */}
                  <div style={styles.conditionsSection}>
                    <div style={styles.sectionTitle}>🎯 Matching Conditions</div>
                    {rule.conditions.message_contains && rule.conditions.message_contains.length > 0 && (
                      <div style={styles.conditionItem}>
                        <span style={styles.conditionLabel}>Message contains (OR): </span>
                        <span style={styles.conditionValue}>{rule.conditions.message_contains.join(', ')}</span>
                      </div>
                    )}
                    {rule.conditions.message_regex && (
                      <div style={styles.conditionItem}>
                        <span style={styles.conditionLabel}>Message regex: </span>
                        <span style={styles.conditionValue}>{rule.conditions.message_regex}</span>
                      </div>
                    )}
                    {rule.conditions.message_exact && (
                      <div style={styles.conditionItem}>
                        <span style={styles.conditionLabel}>Message exact: </span>
                        <span style={styles.conditionValue}>{rule.conditions.message_exact}</span>
                      </div>
                    )}
                    {rule.conditions.node_name_contains && rule.conditions.node_name_contains.length > 0 && (
                      <div style={styles.conditionItem}>
                        <span style={styles.conditionLabel}>Node name contains: </span>
                        <span style={styles.conditionValue}>{rule.conditions.node_name_contains.join(', ')}</span>
                      </div>
                    )}
                    {rule.conditions.object_name_contains && rule.conditions.object_name_contains.length > 0 && (
                      <div style={styles.conditionItem}>
                        <span style={styles.conditionLabel}>Object name contains: </span>
                        <span style={styles.conditionValue}>{rule.conditions.object_name_contains.join(', ')}</span>
                      </div>
                    )}
                    {rule.conditions.network && (
                      <div style={styles.conditionItem}>
                        <span style={styles.conditionLabel}>Network: </span>
                        <span style={styles.conditionValue}>{rule.conditions.network}</span>
                      </div>
                    )}
                  </div>

                  {/* Overrides Section */}
                  {rule.incident_overrides && Object.keys(rule.incident_overrides).length > 0 && (
                    <div style={styles.overridesSection}>
                      <div style={styles.sectionTitle}>⚙️ Incident Field Overrides</div>
                      {rule.incident_overrides.short_description && (
                        <div style={styles.conditionItem}>
                          <span style={styles.conditionLabel}>Short description: </span>
                          <span style={styles.conditionValue}>{rule.incident_overrides.short_description}</span>
                        </div>
                      )}
                  {/* Show mapping overrides (dynamic, skipping templates) */}
                  {Object.entries(rule.incident_overrides || {})
                    .filter(([k]) => !['short_description','description'].includes(k))
                    .filter(([k]) => !['_id','grafana_name','service_offering','business_service','enabled','created_at','updated_at'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} style={styles.conditionItem}>
                        <span style={styles.conditionLabel}>{k.replace(/_/g,' ')}: </span>
                        <span style={styles.conditionValue}>{String(v)}</span>
                      </div>
                    ))}
                      {rule.incident_overrides.description && (
                        <div style={styles.conditionItem}>
                          <span style={styles.conditionLabel}>Description template: </span>
                          <div style={{
                            ...styles.conditionValue,
                            display: 'block',
                            marginTop: '5px',
                            padding: '10px',
                            whiteSpace: 'pre-wrap',
                            maxHeight: '100px',
                            overflow: 'auto'
                          }}>
                            {rule.incident_overrides.description}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {rule.created_at && (
                    <div style={{fontSize: '12px', color: '#666', marginTop: '10px'}}>
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
      )}

      {/* Help Section */}
      {(mappings.length > 0 || rules.length > 0) && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#e7f3ff',
          borderRadius: '8px',
          border: '1px solid #b3d9ff'
        }}>
          <h4 style={{margin: '0 0 15px 0', color: '#004085'}}>How Enhanced Incident Management Works</h4>
          
          <div style={{marginBottom: '15px'}}>
            <strong style={{color: '#004085'}}>System Mappings:</strong>
            <ul style={{margin: '5px 0 0 20px', color: '#004085', fontSize: '14px'}}>
              <li>Define base incident settings for each Grafana application</li>
              <li>Set assignment groups, service offerings, and other ServiceNow fields</li>
              <li>Serve as fallback when no specific rules match</li>
            </ul>
          </div>

          <div style={{marginBottom: '15px'}}>
            <strong style={{color: '#004085'}}>Incident Rules:</strong>
            <ul style={{margin: '5px 0 0 20px', color: '#004085', fontSize: '14px'}}>
              <li>Create specific handling for different alert types (CPU, memory, disk, etc.)</li>
              <li>Use conditions to match alerts based on message content, node names, networks</li>
              <li>Override incident fields with custom templates and priority levels</li>
              <li>Process in priority order - first matching enabled rule wins</li>
            </ul>
          </div>

          <div>
            <strong style={{color: '#004085'}}>When an Alert Arrives:</strong>
            <ol style={{margin: '5px 0 0 20px', color: '#004085', fontSize: '14px'}}>
              <li>System looks for enabled incident rules matching the application</li>
              <li>Checks each rule's conditions in priority order</li>
              <li>If a rule matches: uses that rule's overrides + base system mapping</li>
              <li>If no rules match: falls back to basic system mapping behavior</li>
              <li>Creates ServiceNow incident with appropriate fields and descriptions</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentManagement;
