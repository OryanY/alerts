import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

const baseMandatoryFields = [
    'service_offering',
    'business_service',
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
}) => {
    const customFieldsInMapping = Object.keys(mapping).filter(
        (k) => !excludeFromCustom.includes(k)
    );

    const renderPatternChip = (pattern, idx) => {
        const p = typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
        const colorsForType = PATTERN_COLORS[p.type] || PATTERN_COLORS.exact;

        return (
            <span
                key={idx}
                style={{
                    background: colors.bg.tertiary,
                    color: colors.text.primary,
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    border: `1px solid ${colors.border.primary}`,
                    borderLeft: `3px solid ${colorsForType.main}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontFamily: p.type === 'regex' ? 'monospace' : 'inherit',
                }}
            >
                <span style={{ opacity: 0.6 }}>{PATTERN_TYPES[p.type].icon}</span>
                <span>{p.value}</span>
            </span>
        );
    };

    return (
        <div
            style={{
                background: colors.bg.secondary,
                borderRadius: 12,
                padding: 20,
                border: `1px solid ${colors.border.primary}`,
                borderTop: `3px solid ${colors.brand.primary}`,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 16,
                }}
            >
                <div style={{ flex: 1 }}>
                    <h4
                        style={{
                            margin: '0 0 10px 0',
                            fontSize: 18,
                            fontWeight: 600,
                            color: colors.text.primary,
                        }}
                    >
                        {mapping.service_offering}
                    </h4>

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginBottom: 8,
                        }}
                    >
                        {(mapping.grafana_names || []).map((pattern, idx) =>
                            renderPatternChip(pattern, idx)
                        )}

                        {mapping.u_system_failure && (
                            <span
                                style={{
                                    background: colors.bg.tertiary,
                                    color: colors.semantic.error,
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 600,
                                    border: `1px solid ${colors.border.primary}`,
                                    borderLeft: `3px solid ${colors.semantic.error}`,
                                }}
                            >
                                SYSTEM FAILURE
                            </span>
                        )}
                        {customFieldsInMapping.length > 0 && (
                            <span
                                style={{
                                    background: colors.bg.tertiary,
                                    color: colors.text.primary,
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    fontWeight: 500,
                                    border: `1px solid ${colors.border.primary}`,
                                    borderLeft: `3px solid ${colors.brand.purple}`,
                                }}
                            >
                                {customFieldsInMapping.length} Custom Field
                                {customFieldsInMapping.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => onEdit(mapping)}
                        style={{
                            background: colors.brand.primary,
                            color: colors.text.inverse,
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 14px',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Edit size={14} />
                        Edit
                    </button>
                    <button
                        onClick={() => onDelete(mapping._id)}
                        style={{
                            background: 'transparent',
                            color: colors.semantic.error,
                            border: `1px solid ${colors.semantic.error}`,
                            borderRadius: 6,
                            padding: '8px 14px',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                </div>
            </div>

            {/* Base Required Fields */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: 12,
                    marginBottom: customFieldsInMapping.length > 0 ? 12 : 0,
                }}
            >
                <div
                    style={{
                        background: colors.bg.tertiary,
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
                        background: colors.bg.tertiary,
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
                        {mapping.business_service}
                    </div>
                </div>

                <div
                    style={{
                        background: colors.bg.tertiary,
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
                        background: colors.bg.tertiary,
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
                        background: colors.bg.tertiary,
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
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 10,
                        }}
                    >
                        {customFieldsInMapping.map((fieldName) => (
                            <div
                                key={fieldName}
                                style={{
                                    background: colors.bg.secondary,
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
    );
};

export default MappingCard;
