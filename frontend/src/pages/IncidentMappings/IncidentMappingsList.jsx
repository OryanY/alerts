import { ChevronLeft, ChevronRight } from 'lucide-react'; // Need to add import
import MappingCardComponent from '../../components/IncidentMappings/MappingCard';

const IncidentMappingsList = ({
  mappings,
  totalItems,
  currentPage,
  totalPages,
  onPageChange,
  colors,
  PATTERN_TYPES,
  PATTERN_COLORS,
  assignmentGroups,
  onEdit,
  onDelete,
  viewMode,
}) => {
  if (totalItems === 0 && mappings.length === 0) {
    // Empty state
    return (
      <div
        style={{
          background: colors.bg.secondary,
          border: `1px dashed ${colors.border.secondary}`,
          borderRadius: 12,
          padding: 48,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📋</div>
        <h3
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: colors.text.primary,
            marginBottom: 8,
          }}
        >
          No Mappings Found
        </h3>
        <p
          style={{
            fontSize: 14,
            color: colors.text.secondary,
            marginBottom: 0,
            maxWidth: 500,
            margin: '0 auto',
          }}
        >
          Try adjusting your search or create a new mapping.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          padding: '0 4px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 600,
            color: colors.text.primary,
          }}
        >
          Found {totalItems} Mappings
        </h3>

        <div style={{ fontSize: 13, color: colors.text.secondary }}>
          Page {currentPage} of {totalPages}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {mappings.map((m) => (
          <MappingCardComponent
            key={m._id}
            mapping={m}
            colors={colors}
            PATTERN_TYPES={PATTERN_TYPES}
            PATTERN_COLORS={PATTERN_COLORS}
            assignmentGroups={assignmentGroups}
            onEdit={onEdit}
            onDelete={onDelete}
            viewMode={viewMode}
          />
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          marginTop: 32,
          paddingTop: 20,
          borderTop: `1px solid ${colors.border.primary}`
        }}>
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${colors.border.primary}`,
              background: currentPage === 1 ? colors.bg.tertiary : colors.bg.secondary,
              color: currentPage === 1 ? colors.text.tertiary : colors.text.primary,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <span style={{ fontSize: 14, fontWeight: 600, color: colors.text.primary }}>
            {currentPage} / {totalPages}
          </span>

          <button
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${colors.border.primary}`,
              background: currentPage === totalPages ? colors.bg.tertiary : colors.bg.secondary,
              color: currentPage === totalPages ? colors.text.tertiary : colors.text.primary,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default IncidentMappingsList;
