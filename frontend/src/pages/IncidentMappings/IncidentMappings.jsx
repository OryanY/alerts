import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import MappingForm from '../../components/IncidentMappings/MappingForm';
import IncidentMappingsList from './IncidentMappingsList';
import IncidentMappingsHeader from '../../components/IncidentMappings/IncidentMappingsHeader';
import { safeJson } from '../../utils/api';

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



const IncidentMappings = () => {
  const { colors, gradients, PATTERN_COLORS } = useTheme();
  const formRef = useRef(null);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [assignmentGroups, setAssignmentGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('incident_mappings_view_mode') || 'compact';
    } catch {
      return 'compact';
    }
  });

  const toggleViewMode = () => {
    setViewMode((prev) => {
      const next = prev === 'compact' ? 'expanded' : 'compact';
      try {
        localStorage.setItem('incident_mappings_view_mode', next);
      } catch {}
      return next;
    });
  };

  const fetchMappings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/incidents/system-mappings`, { credentials: 'include' });
      const data = await safeJson(res);
      if (data.success) {
        setMappings(data.data || []);
      } else {
        const errorMsg = data.error?.message || 'Failed to fetch system mappings';
        if (Object.keys(data).length === 0) {
          setError('Authentication required');
        } else {
          setError(errorMsg);
        }
      }
    } catch (e) {
      setError('Error connecting to server: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentGroups = async () => {
    try {
      setLoadingGroups(true);
      const res = await fetch(`${API_BASE}/incidents/assignment-groups`, { credentials: 'include' });
      const data = await safeJson(res);
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
    if (!window.confirm('Are you sure you want to delete this mapping?')) return;
    try {
      const res = await fetch(`${API_BASE}/incidents/system-mappings/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await safeJson(res);
      if (data.success) {
        await fetchMappings();
        setError(null);
      } else {
        const errorMsg = data.error?.message || 'Failed to delete mapping';
        console.log(errorMsg);
        setError(errorMsg);
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

  // FILTERING & PAGINATION
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredMappings = mappings.filter((m) => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();

    // Fields to search
    const groupLabel = assignmentGroups.find(g => g.value === m.assignment_group)?.label || '';

    const fieldsToCheck = [
      m.service_offering_label || m.service_offering,
      m.business_service_label || m.business_service,
      m.assignment_group,
      groupLabel
    ];

    // Check basic fields
    const basicMatch = fieldsToCheck.some(val => val && val.toLowerCase().includes(lower));
    if (basicMatch) return true;

    // Check grafana names (patterns)
    if (m.grafana_names && Array.isArray(m.grafana_names)) {
      return m.grafana_names.some(p => {
        const val = typeof p === 'string' ? p : p.value;
        return val.toLowerCase().includes(lower);
      });
    }

    return false;
  });

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Slicing
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredMappings.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredMappings.length / itemsPerPage);

  // Handlers
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // smooth scroll top of list
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
          {/* We can use a simpler loading indicator or extract RefreshCw if needed, but for now simple text is fine or import RefreshCw */}
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
        maxWidth: '1000px',
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
      <IncidentMappingsHeader
        showForm={showForm}
        onCreateClick={handleCreateClick}
        onRefresh={fetchMappings}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
      />

      {/* FORM */}
      {showForm && (
        <div ref={formRef}>
          <MappingForm
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

      {/* LIST (Only show when NOT editing) */}
      {!showForm && (
        <IncidentMappingsList
          mappings={currentItems}
          totalItems={filteredMappings.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          colors={colors}
          PATTERN_TYPES={PATTERN_TYPES}
          PATTERN_COLORS={PATTERN_COLORS}
          assignmentGroups={assignmentGroups}
          onEdit={handleEdit}
          onDelete={handleDelete}
          viewMode={viewMode}
        />
      )}
    </div>
  );
};

export default IncidentMappings;
