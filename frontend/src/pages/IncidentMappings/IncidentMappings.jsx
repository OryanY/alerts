import { useEffect, useState,useRef } from 'react';
import {
  Settings,
  Plus,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import IncidentMappingsForm from './IncidentMappingsForm';
import IncidentMappingsList from './IncidentMappingsList';

// Pattern types are semantic only (no colors here)
export const PATTERN_TYPES = {
  exact: {
    label: 'Exact Match',
    icon: '🎯',
    description: 'Matches exactly this application name',
    example: 'mongo',
    placeholder: 'e.g., mongo, eck',
  },
  contains: {
    label: 'Contains',
    icon: '🔍',
    description: 'Matches any application containing this text',
    example: 'db (matches: mongodb, postgresdb, db-prod)',
    placeholder: 'e.g., db, prod, memory',
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
export const withAlpha = (hex, alpha = '20') => `${hex}${alpha}`;

const IncidentMappings = () => {
  const { colors,gradients,PATTERN_COLORS } = useTheme();
  const formRef = useRef(null);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [assignmentGroups, setAssignmentGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/incidents/system-mappings`);
      const data = await res.json();
      if (data.success) setMappings(data.data || []);
      else setError(data.error.message || 'Failed to fetch system mappings');
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

  const handleCreateClick = () => {
    setEditingItem(null);
    setShowForm((prev) => !prev);
  };

  const handleEdit = (m) => {
  setEditingItem(m);
  setShowForm(true);
  setTimeout(() => {
    formRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    }, 100);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    try {
      const res = await fetch(`${API_BASE}/incidents/system-mappings/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchMappings();
        setError(null);
      } else {
        console.log(data.error.message);
        setError(data.error.message || 'Failed to delete mapping');
      }
    } catch (e) {
      setError('Error deleting mapping: ' + e.message);
    }
  };

  const handleSaved = async () => {
    await fetchMappings();
    setEditingItem(null);
    setShowForm(false);
    setError(null);
  };

  const handleCancelForm = () => {
    setEditingItem(null);
    setShowForm(false);
  };

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
              color: colors.text.primary,
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
            onClick={handleCreateClick}
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
          <div ref={formRef}> 
        <IncidentMappingsForm
          colors={colors}
          gradients={gradients}
          PATTERN_TYPES={PATTERN_TYPES}
          PATTERN_COLORS={PATTERN_COLORS}
          assignmentGroups={assignmentGroups}
          loadingGroups={loadingGroups}
          editingItem={editingItem}
          onSaved={handleSaved}
          onCancel={handleCancelForm}
          onError={setError}
        />
        </div>
      )}

      {/* LIST */}
      <IncidentMappingsList
        mappings={mappings}
        colors={colors}
        gradients={gradients}
        PATTERN_TYPES={PATTERN_TYPES}
        PATTERN_COLORS={PATTERN_COLORS}
        assignmentGroups={assignmentGroups}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default IncidentMappings;
