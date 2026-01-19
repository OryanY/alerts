import { useTheme } from '../../contexts/ThemeContext';

const IncidentOverrides = ({ form, setForm, selectedMapping, customFieldsInMapping, assignmentGroups }) => {
    const { colors, gradients } = useTheme();

    return (
        <div
            style={{
                background: gradients.successGradient,
                padding: 24,
                borderRadius: 12,
                border: `2px solid ${colors.semantic.success}`,
            }}
        >
            <h4
                style={{
                    margin: '0 0 20px 0',
                    fontSize: 18,
                    fontWeight: 600,
                    color: colors.semantic.successText,
                }}
            >
                THEN Override Incident Fields...
            </h4>

            <div
                style={{
                    background: colors.bg.secondary,
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 20,
                    border: `1px solid ${colors.semantic.success}`,
                }}
            >
                <p
                    style={{
                        margin: 0,
                        fontSize: 14,
                        color: colors.semantic.successText,
                        fontWeight: 500,
                    }}
                >
                    💡 Template Variables:{' '}
                    <code
                        style={{
                            background: colors.semantic.successBg,
                            padding: '2px 6px',
                            borderRadius: 4,
                        }}
                    >
                        {'{{ application }}'}
                    </code>
                    <code
                        style={{
                            background: colors.semantic.successBg,
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginLeft: 4,
                        }}
                    >
                        {'{{ object_name }}'}
                    </code>
                    <code
                        style={{
                            background: colors.semantic.successBg,
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginLeft: 4,
                        }}
                    >
                        {'{{ node_name }}'}
                    </code>
                    <code
                        style={{
                            background: colors.semantic.successBg,
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginLeft: 4,
                        }}
                    >
                        {'{{ message }}'}
                    </code>
                    <code
                        style={{
                            background: colors.semantic.successBg,
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginLeft: 4,
                        }}
                    >
                        {'{{ operator }}'}
                    </code>
                    <code
                        style={{
                            background: colors.semantic.successBg,
                            padding: '2px 6px',
                            borderRadius: 4,
                            marginLeft: 4,
                        }}
                    >
                        {'{{ network }}'}
                    </code>
                </p>
            </div>

            {!selectedMapping && (
                <div
                    style={{
                        background: colors.semantic.warningBg,
                        padding: 16,
                        borderRadius: 8,
                        border: `2px solid ${colors.semantic.warning}`,
                        marginBottom: 20,
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontSize: 14,
                            color: colors.semantic.warningText,
                        }}
                    >
                        ⚠️ Select a system mapping first to see available fields and their base
                        values
                    </p>
                </div>
            )}

            {/* Standard Override Fields */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 16,
                    marginBottom: 16,
                }}
            >
                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 8,
                        }}
                    >
                        Short Description
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: `2px solid ${colors.semantic.success}`,
                            borderRadius: 8,
                            fontSize: 14,
                            background: colors.bg.secondary,
                            color: colors.text.primary,
                        }}
                        value={form.incident_overrides.short_description || ''}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                    ...p.incident_overrides,
                                    short_description: e.target.value,
                                },
                            }))
                        }
                        placeholder="Alert: {{object_name}} on {{node_name}}"
                    />
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>
                                {selectedMapping.short_description ||
                                    'קפצה התראה על: {{object_name}} - {{application}}'}
                            </strong>
                        </p>
                    )}
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 8,
                        }}
                    >
                        Assignment Group
                    </label>
                    <select
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: `2px solid ${colors.semantic.success}`,
                            borderRadius: 8,
                            fontSize: 14,
                            background: colors.bg.secondary,
                            color: colors.text.primary,
                        }}
                        value={form.incident_overrides.assignment_group || ''}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                    ...p.incident_overrides,
                                    assignment_group: e.target.value,
                                },
                            }))
                        }
                    >
                        <option value="">Override assignment group...</option>
                        {assignmentGroups && assignmentGroups.map(group => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>{selectedMapping.assignment_group || '—'}</strong>
                        </p>
                    )}
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 8,
                        }}
                    >
                        Service Offering
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: `2px solid ${colors.semantic.success}`,
                            borderRadius: 8,
                            fontSize: 14,
                            background: colors.bg.secondary,
                            color: colors.text.primary,
                        }}
                        value={form.incident_overrides.service_offering || ''}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                    ...p.incident_overrides,
                                    service_offering: e.target.value,
                                },
                            }))
                        }
                        placeholder="Override service offering"
                    />
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>{selectedMapping.service_offering || '—'}</strong>
                        </p>
                    )}
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 8,
                        }}
                    >
                        Business Service
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: `2px solid ${colors.semantic.success}`,
                            borderRadius: 8,
                            fontSize: 14,
                            background: colors.bg.secondary,
                            color: colors.text.primary,
                        }}
                        value={form.incident_overrides.business_service || ''}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                    ...p.incident_overrides,
                                    business_service: e.target.value,
                                },
                            }))
                        }
                        placeholder="Override business service"
                    />
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>{selectedMapping.business_service || '—'}</strong>
                        </p>
                    )}
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 8,
                        }}
                    >
                        Network
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: `2px solid ${colors.semantic.success}`,
                            borderRadius: 8,
                            fontSize: 14,
                            background: colors.bg.secondary,
                            color: colors.text.primary,
                        }}
                        value={form.incident_overrides.u_network || ''}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                    ...p.incident_overrides,
                                    u_network: e.target.value,
                                },
                            }))
                        }
                        placeholder="Override network (e.g., PROD, QA)"
                    />
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>{selectedMapping.u_network || '—'}</strong>
                        </p>
                    )}
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 8,
                        }}
                    >
                        Impact Technology
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: `2px solid ${colors.semantic.success}`,
                            borderRadius: 8,
                            fontSize: 14,
                            background: colors.bg.secondary,
                            color: colors.text.primary,
                        }}
                        value={form.incident_overrides.u_impact_technology || ''}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                    ...p.incident_overrides,
                                    u_impact_technology: e.target.value,
                                },
                            }))
                        }
                        placeholder="Override impact technology"
                    />
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>
                                {selectedMapping.u_impact_technology || '—'}
                            </strong>
                        </p>
                    )}
                </div>

                <div>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            marginBottom: 8,
                        }}
                    >
                        Operational Impact
                    </label>
                    <input
                        style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: `2px solid ${colors.semantic.success}`,
                            borderRadius: 8,
                            fontSize: 14,
                            background: colors.bg.secondary,
                            color: colors.text.primary,
                        }}
                        value={form.incident_overrides.u_operational_impact || ''}
                        onChange={(e) =>
                            setForm((p) => ({
                                ...p,
                                incident_overrides: {
                                    ...p.incident_overrides,
                                    u_operational_impact: e.target.value,
                                },
                            }))
                        }
                        placeholder="Override operational impact (default: בבדיקה)"
                    />
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 0',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>
                                {selectedMapping.u_operational_impact || '—'}
                            </strong>
                        </p>
                    )}
                </div>

                <div>
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            fontSize: 14,
                            fontWeight: 600,
                            color: colors.semantic.successText,
                            cursor: 'pointer',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={form.incident_overrides.u_system_failure || false}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    incident_overrides: {
                                        ...p.incident_overrides,
                                        u_system_failure: e.target.checked,
                                    },
                                }))
                            }
                            style={{ width: 18, height: 18 }}
                        />
                        System Failure
                    </label>
                    <p
                        style={{
                            margin: '4px 0 0 30px',
                            fontSize: 12,
                            color: colors.semantic.successText,
                        }}
                    >
                        Creates outage automatically
                    </p>
                    {selectedMapping && (
                        <p
                            style={{
                                margin: '4px 0 0 30px',
                                fontSize: 12,
                                color: colors.semantic.successText,
                            }}
                        >
                            📋 Base:{' '}
                            <strong>
                                {selectedMapping.u_system_failure ? 'YES' : 'NO'}
                            </strong>
                        </p>
                    )}
                </div>
            </div>

            {/* Full Description */}
            <div style={{ marginBottom: 20 }}>
                <label
                    style={{
                        display: 'block',
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.successText,
                        marginBottom: 8,
                    }}
                >
                    Description (Full)
                </label>
                <textarea
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: `2px solid ${colors.semantic.success}`,
                        borderRadius: 8,
                        fontSize: 14,
                        background: colors.bg.secondary,
                        color: colors.text.primary,
                        minHeight: 120,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                    }}
                    value={form.incident_overrides.description || ''}
                    onChange={(e) =>
                        setForm((p) => ({
                            ...p,
                            incident_overrides: {
                                ...p.incident_overrides,
                                description: e.target.value,
                            },
                        }))
                    }
                    placeholder={
                        'Full incident description with template variables...\nExample:\nAlert: {{object_name}} on {{node_name}}\nMessage: {{message}}\nOperator: {{operator}}'
                    }
                />
                {selectedMapping && (
                    <p
                        style={{
                            margin: '4px 0 0 0',
                            fontSize: 12,
                            color: colors.semantic.successText,
                        }}
                    >
                        📋 Base:{' '}
                        <strong>
                            {selectedMapping.description || 'ההתראה: Message: {{message}}'}
                        </strong>
                    </p>
                )}
            </div>

            {/* Custom fields for selected mapping */}
            {customFieldsInMapping.length > 0 && (
                <div
                    style={{
                        background: gradients.neutralSoftGradient,
                        padding: 20,
                        borderRadius: 8,
                        border: `2px solid ${colors.brand.purple}`,
                    }}
                >
                    <h5
                        style={{
                            margin: '0 0 16px 0',
                            fontSize: 16,
                            fontWeight: 600,
                            color: colors.brand.purple,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        ⚙️ Custom Fields ({customFieldsInMapping.length})
                    </h5>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                            gap: 16,
                        }}
                    >
                        {customFieldsInMapping.map((fieldName) => (
                            <div key={fieldName}>
                                <label
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: colors.brand.purple,
                                        marginBottom: 8,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                    }}
                                >
                                    <span style={{ fontFamily: 'monospace' }}>{fieldName}</span>
                                </label>
                                <input
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: `2px solid ${colors.brand.purple}`,
                                        borderRadius: 8,
                                        fontSize: 14,
                                        background: colors.bg.secondary,
                                        color: colors.text.primary,
                                    }}
                                    value={form.incident_overrides[fieldName] || ''}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            incident_overrides: {
                                                ...p.incident_overrides,
                                                [fieldName]: e.target.value,
                                            },
                                        }))
                                    }
                                    placeholder={`Override ${fieldName} (optional)`}
                                />
                                <p
                                    style={{
                                        margin: '4px 0 0 0',
                                        fontSize: 12,
                                        color: colors.brand.purple,
                                    }}
                                >
                                    📋 Base value:{' '}
                                    <strong style={{ fontFamily: 'monospace' }}>
                                        {selectedMapping?.[fieldName] || '—'}
                                    </strong>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IncidentOverrides;
