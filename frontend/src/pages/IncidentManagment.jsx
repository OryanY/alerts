import React, { useState, useEffect } from 'react';

const IncidentManagement = () => {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMapping, setEditingMapping] = useState(null);
  const [formData, setFormData] = useState({
    grafana_name: '',
    service_offering: '',
    business_service: '',
    u_site: '',
    u_network: '',
    u_impact_technology: '',
    assignment_group: '',
    u_monitor_identifier: 'from_grafana'
  });

  // API Base URL
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

  // Save mapping (create or update)
  const saveMapping = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingMapping 
        ? `${API_BASE}/system-mappings/${editingMapping._id}`
        : `${API_BASE}/system-mappings`;
      
      const method = editingMapping ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchMappings(); // Refresh the list
        resetForm();
        setShowForm(false);
      } else {
        setError(data.details || 'Failed to save mapping');
      }
    } catch (err) {
      setError('Error saving mapping: ' + err.message);
    }
  };

  // Delete mapping
  const deleteMapping = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/system-mappings/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchMappings(); // Refresh the list
      } else {
        setError(data.details || 'Failed to delete mapping');
      }
    } catch (err) {
      setError('Error deleting mapping: ' + err.message);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      grafana_name: '',
      service_offering: '',
      business_service: '',
      u_site: '',
      u_network: '',
      u_impact_technology: '',
      assignment_group: '',
      u_monitor_identifier: 'from_grafana'
    });
    setEditingMapping(null);
  };

  // Start editing
  const startEdit = (mapping) => {
    setFormData({
      grafana_name: mapping.grafana_name || '',
      service_offering: mapping.service_offering || '',
      business_service: mapping.business_service || '',
      u_site: mapping.u_site || '',
      u_network: mapping.u_network || '',
      u_impact_technology: mapping.u_impact_technology || '',
      assignment_group: mapping.assignment_group || '',
      u_monitor_identifier: mapping.u_monitor_identifier || 'from_grafana'
    });
    setEditingMapping(mapping);
    setShowForm(true);
  };

  // Handle input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const styles = {
    container: {
      maxWidth: '1200px',
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
    mappingCard: {
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '20px',
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    mappingHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px',
      paddingBottom: '10px',
      borderBottom: '2px solid #e9ecef'
    },
    applicationName: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#007bff'
    },
    mappingGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
      gap: '10px',
      marginBottom: '15px'
    },
    mappingItem: {
      padding: '8px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      fontSize: '14px'
    },
    label: {
      fontWeight: 'bold',
      color: '#495057',
      marginBottom: '2px'
    },
    value: {
      color: '#6c757d'
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
    formActions: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'flex-end'
    },
    noMappings: {
      textAlign: 'center',
      padding: '40px',
      color: '#666',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading system mappings...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Incident Management - System Mappings</h1>
        <p style={styles.subtitle}>
          Configure how Grafana alerts are mapped to ServiceNow incidents. When an alert is triggered, 
          the system will use these mappings to create incidents with the appropriate assignment and metadata.
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

      <div>
        <button 
          style={styles.button}
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? 'Cancel' : 'Add New Mapping'}
        </button>
        
        <button 
          style={styles.buttonSecondary}
          onClick={fetchMappings}
        >
          Refresh
        </button>
      </div>

      {showForm && (
        <div style={styles.form}>
          <h3>{editingMapping ? 'Edit System Mapping' : 'Create New System Mapping'}</h3>
          <form onSubmit={saveMapping}>
            <div style={styles.formGrid}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Grafana Application Name *</label>
                <input
                  type="text"
                  name="grafana_name"
                  value={formData.grafana_name}
                  onChange={handleInputChange}
                  style={styles.formInput}
                  required
                  placeholder="e.g., eck"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Service Offering *</label>
                <input
                  type="text"
                  name="service_offering"
                  value={formData.service_offering}
                  onChange={handleInputChange}
                  style={styles.formInput}
                  required
                  placeholder="e.g., Elastic - eck"
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Business Service *</label>
                <input
                  type="text"
                  name="business_service"
                  value={formData.business_service}
                  onChange={handleInputChange}
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
                  value={formData.u_site}
                  onChange={handleInputChange}
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
                  value={formData.u_network}
                  onChange={handleInputChange}
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
                  value={formData.u_impact_technology}
                  onChange={handleInputChange}
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
                  value={formData.assignment_group}
                  onChange={handleInputChange}
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
                  value={formData.u_monitor_identifier}
                  onChange={handleInputChange}
                  style={styles.formInput}
                  placeholder="from_grafana"
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
                {editingMapping ? 'Update Mapping' : 'Create Mapping'}
              </button>
            </div>
          </form>
        </div>
      )}

      {mappings.length === 0 ? (
        <div style={styles.noMappings}>
          <h3>No System Mappings Found</h3>
          <p>Create your first mapping to start routing Grafana alerts to ServiceNow incidents.</p>
        </div>
      ) : (
        <div>
          <h3>Current System Mappings ({mappings.length})</h3>
          {mappings.map((mapping) => (
            <div key={mapping._id} style={styles.mappingCard}>
              <div style={styles.mappingHeader}>
                <div>
                  <div style={styles.applicationName}>
                    If alert is on application: "{mapping.grafana_name}"
                  </div>
                  <div style={{fontSize: '14px', color: '#666', marginTop: '5px'}}>
                    then open incident with:
                  </div>
                </div>
                <div>
                  <button 
                    style={styles.buttonSecondary}
                    onClick={() => startEdit(mapping)}
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
              
              <div style={styles.mappingGrid}>
                <div style={styles.mappingItem}>
                  <div style={styles.label}>Assignment Group:</div>
                  <div style={styles.value}>{mapping.assignment_group}</div>
                </div>
                
                <div style={styles.mappingItem}>
                  <div style={styles.label}>Service Offering:</div>
                  <div style={styles.value}>{mapping.service_offering}</div>
                </div>
                
                <div style={styles.mappingItem}>
                  <div style={styles.label}>Business Service:</div>
                  <div style={styles.value}>{mapping.business_service}</div>
                </div>
                
                <div style={styles.mappingItem}>
                  <div style={styles.label}>Site:</div>
                  <div style={styles.value}>{mapping.u_site}</div>
                </div>
                
                <div style={styles.mappingItem}>
                  <div style={styles.label}>Network:</div>
                  <div style={styles.value}>{mapping.u_network}</div>
                </div>
                
                <div style={styles.mappingItem}>
                  <div style={styles.label}>Impact Technology:</div>
                  <div style={styles.value}>{mapping.u_impact_technology}</div>
                </div>
                
                <div style={styles.mappingItem}>
                  <div style={styles.label}>Monitor Identifier:</div>
                  <div style={styles.value}>{mapping.u_monitor_identifier}</div>
                </div>
                
                {mapping.created_at && (
                  <div style={styles.mappingItem}>
                    <div style={styles.label}>Created:</div>
                    <div style={styles.value}>
                      {new Date(mapping.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
              
              <div style={{
                fontSize: '12px', 
                color: '#28a745',
                backgroundColor: '#d4edda',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #c3e6cb'
              }}>
                <strong>Short Description:</strong> Alert: {'{object_name}'} in {mapping.grafana_name}
                <br />
                <strong>Description:</strong> Will include application, object, node, message, time, and operator details
              </div>
            </div>
          ))}
        </div>
      )}
      
      {mappings.length > 0 && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#e7f3ff',
          borderRadius: '8px',
          border: '1px solid #b3d9ff'
        }}>
          <h4 style={{margin: '0 0 10px 0', color: '#004085'}}>How It Works</h4>
          <p style={{margin: '0', color: '#004085', fontSize: '14px'}}>
            When a Grafana alert is triggered, the system will:
          </p>
          <ol style={{margin: '10px 0 0 20px', color: '#004085', fontSize: '14px'}}>
            <li>Look up the application name in these mappings</li>
            <li>Create a ServiceNow incident with the mapped assignment group and metadata</li>
            <li>Include the alert details (object, node, message, etc.) in the incident description</li>
            <li>Set the appropriate site, network, and impact technology fields</li>
          </ol>
        </div>
      )}
    </div>
  );
};

export default IncidentManagement;