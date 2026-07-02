import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useExpandableCard } from '../../hooks/useExpandableCard';

const baseMandatoryFields = [
    'service_offering',
    'business_service',
    'service_offering_label',
    'business_service_label',
    'u_network',
    'u_impact_technology',
    'assignment_group',
    'u_system_failure',
];

const excludeFromCustom = [
    '_id',
    'grafana_names',
    'created_at',
    'updated_at',
    ...baseMandatoryFields,
];

const MappingCard = ({
    mapping,
    colors,
    PATTERN_TYPES,
    PATTERN_COLORS,
    assignmentGroups,
    onEdit,
    onDelete,
    viewMode,
}) => {
    const customFieldsInMapping = Object.keys(mapping).filter(
        (k) => !excludeFromCustom.includes(k)
    );

    const { isExpanded, isCompact, shouldShowDetails, handleCardClick } = useExpandableCard(viewMode);

    return (
        <div
            onClick={handleCardClick}
            style={{
                background: colors.bg.secondary,
                borderRadius: 12,
                border: `1px solid ${colors.border.primary}`,
                borderTop: `3px solid ${colors.brand.primary}`,
                transition: 'all 0.2s ease',
                boxShadow: colors.shadow.sm,
                cursor: isCompact ? 'pointer' : 'default',
            }}
            onMouseEnter={(e) => {
                if (isCompact) {
                    e.currentTarget.style.boxShadow = colors.shadow.md;
                    e.currentTarget.style.borderColor = colors.border.secondary;
                }
            }}
            onMouseLeave={(e) => {
                if (isCompact) {
                    e.currentTarget.style.boxShadow = colors.shadow.sm;
                    e.currentTarget.style.borderColor = colors.border.primary;
                }
            }}
        >
            {/* Header Row */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, flexWrap: 'wrap' }}>
                    {isCompact && (
                        <span style={{ color: colors.text.tertiary, display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </span>
                    )}

                    <h4
                        style={{
                            margin: 0,
                            fontSize: 16,
                            fontWeight: 600,
                            color: colors.text.primary,
                            minWidth: '220px',
                        }}
                    >
                        {mapping.service_offering_label || mapping.service_offering}
                    </h4>

                    {/* Patterns Display */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(mapping.grafana_names || []).slice(0, 3).map((pattern, idx) => {
                            const p = typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
                            const colorsForType = PATTERN_COLORS[p.type] || PATTERN_COLORS.exact;
                            return (
                                <span
                                    key={idx}
                                    style={{
                                        background: colors.bg.tertiary,
                                        color: colors.text.primary,
                                        padding: '4px 8px',
                                        borderRadius: 4,
                                        fontSize: 11,
                                        fontWeight: 500,
                                        border: `1px solid ${colors.border.primary}`,
                                        borderLeft: `2px solid ${colorsForType.main}`,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                    }}
                                >
                                    <span style={{ opacity: 0.6 }}>{PATTERN_TYPES[p.type].icon}</span>
                                    <span>{p.value}</span>
                                </span>
                            );
                        })}
                        {(mapping.grafana_names || []).length > 3 && (
                            <span style={{ fontSize: 11, color: colors.text.tertiary, alignSelf: 'center' }}>
                                +{(mapping.grafana_names || []).length - 3} more
                            </span>
                        )}

                        {mapping.u_system_failure && (
                            <span
                                style={{
                                    background: colors.bg.tertiary,
                                    color: colors.semantic.error,
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    border: `1px solid ${colors.border.primary}`,
                                    borderLeft: `2px solid ${colors.semantic.error}`,
                                }}
                            >
                                SYSTEM FAILURE
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {/* Baseline Group Label */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 150 }}>
                        <span style={{ fontSize: 9, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Baseline Group</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: colors.text.secondary }}>
                            {assignmentGroups.find((g) => g.value === mapping.assignment_group)?.label || mapping.assignment_group}
                        </span>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => onEdit(mapping)}
                            style={{
                                background: colors.brand.primary,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => onDelete(mapping._id)}
                            style={{
                                background: 'transparent',
                                color: colors.semantic.error,
                                border: `1px solid ${colors.semantic.error}`,
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                            }}
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* Details Panel */}
            {shouldShowDetails && (
                <div
                    style={{
                        padding: '20px',
                        borderTop: `1px solid ${colors.border.secondary}`,
                        background: colors.bg.primary,
                        borderBottomLeftRadius: 12,
                        borderBottomRightRadius: 12,
                    }}
                >
                    {/* Base Required Fields */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 12,
                            marginBottom: customFieldsInMapping.length > 0 ? 16 : 0,
                        }}
                    >
                        <div
                            style={{
                                background: colors.bg.secondary,
                                padding: 12,
                                borderRadius: 6,
                                border: `1px solid ${colors.border.primary}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: colors.text.secondary,
                                    marginBottom: 4,
                                }}
                            >
                                Assignment Group
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: colors.text.primary,
                                }}
                            >
                                {assignmentGroups.find((g) => g.value === mapping.assignment_group)?.label ||
                                    mapping.assignment_group}
                            </div>
                        </div>

                        <div
                            style={{
                                background: colors.bg.secondary,
                                padding: 12,
                                borderRadius: 6,
                                border: `1px solid ${colors.border.primary}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: colors.text.secondary,
                                    marginBottom: 4,
                                }}
                            >
                                Business Service
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: colors.text.primary,
                                }}
                            >
                                {mapping.business_service_label || mapping.business_service}
                            </div>
                        </div>

                        <div
                            style={{
                                background: colors.bg.secondary,
                                padding: 12,
                                borderRadius: 6,
                                border: `1px solid ${colors.border.primary}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: colors.text.secondary,
                                    marginBottom: 4,
                                }}
                            >
                                Network
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: colors.text.primary,
                                }}
                            >
                                {mapping.u_network}
                            </div>
                        </div>

                        <div
                            style={{
                                background: colors.bg.secondary,
                                padding: 12,
                                borderRadius: 6,
                                border: `1px solid ${colors.border.primary}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: colors.text.secondary,
                                    marginBottom: 4,
                                }}
                            >
                                Impact Technology
                            </div>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: colors.text.primary,
                                }}
                            >
                                {mapping.u_impact_technology}
                            </div>
                        </div>
                    </div>

                    {/* Custom Fields Display */}
                    {customFieldsInMapping.length > 0 && (
                        <div
                            style={{
                                padding: 12,
                                background: colors.bg.secondary,
                                borderRadius: 6,
                                border: `1px solid ${colors.border.primary}`,
                                borderLeft: `3px solid ${colors.brand.purple}`,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: colors.text.secondary,
                                    marginBottom: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                Custom Fields:
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 10,
                                }}
                            >
                                {customFieldsInMapping.map((fieldName) => (
                                    <div
                                        key={fieldName}
                                        style={{
                                            background: colors.bg.primary,
                                            padding: 10,
                                            borderRadius: 6,
                                            border: `1px solid ${colors.border.primary}`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 500,
                                                color: colors.text.secondary,
                                                marginBottom: 4,
                                                fontFamily: 'monospace',
                                            }}
                                        >
                                            {fieldName}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                color: colors.text.primary,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {mapping[fieldName] || (
                                                <span style={{ color: colors.text.tertiary }}>—</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MappingCard;
