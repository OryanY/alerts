import {
    CheckCircle,
    XCircle,
    ToggleLeft,
    ToggleRight,
    AlertTriangle
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { EXCLUDED_MAPPING_FIELDS } from './constants';

const RuleCard = ({
    rule,
    globalRules,
    assignmentGroups,
    onToggle,
    onEdit,
    onDelete,
    renderApplicationChip
}) => {
    const { colors, gradients } = useTheme();

    const ruleMapping = rule.system_mapping;
    const customFieldsInRule = ruleMapping
        ? Object.keys(ruleMapping).filter(
            (k) => !EXCLUDED_MAPPING_FIELDS.includes(k)
        )
        : [];

    return (
        <div
            style={{
                background: colors.bg.secondary,
                borderRadius: 16,
                padding: 24,
                boxShadow: colors.shadow.md,
                border: `1px solid ${colors.border.primary}`,
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: rule.enabled
                        ? colors.semantic.success
                        : colors.border.secondary,
                }}
            />

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 20,
                    marginTop: 8,
                }}
            >
                <div style={{ flex: 1 }}>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 8,
                            flexWrap: 'wrap',
                        }}
                    >
                        <h4
                            style={{
                                margin: 0,
                                fontSize: 18,
                                fontWeight: 700,
                                color: colors.text.primary,
                            }}
                        >
                            {String(rule.rule_name)}
                        </h4>

                        {/* STATUS BADGE */}
                        <div
                            style={{
                                background: rule.enabled
                                    ? colors.semantic.successBg
                                    : colors.bg.tertiary,
                                color: rule.enabled
                                    ? colors.semantic.successText
                                    : colors.text.secondary,
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            {rule.enabled ? (
                                <CheckCircle size={12} />
                            ) : (
                                <XCircle size={12} />
                            )}
                            {rule.enabled ? 'ACTIVE' : 'INACTIVE'}
                        </div>

                        {/* LOGIC BADGE */}
                        <div
                            style={{
                                background: colors.semantic.infoBg,
                                color: colors.semantic.infoText,
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                            }}
                        >
                            {String(rule.logic_operator || 'OR')} Logic
                        </div>

                        {/* CUSTOM FIELDS COUNT */}
                        {customFieldsInRule.length > 0 && (
                            <div
                                style={{
                                    background: colors.bg.tertiary,
                                    color: colors.brand.purple,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    fontWeight: 600,
                                }}
                            >
                                {customFieldsInRule.length} Custom Field
                                {customFieldsInRule.length > 1 ? 's' : ''}
                            </div>
                        )}
                    </div>



                    {/* CONFLICT WARNING */}
                    {!rule.is_global && (
                        (() => {
                            const conflicts = (globalRules || []).filter(gRule => {
                                // Skip if self (shouldn't happen)
                                if (gRule._id === rule._id) return false;

                                // Check for intersection in conditions
                                // If both have the same condition key/value, they collide
                                const sCond = rule.conditions || {};
                                const gCond = gRule.conditions || {};

                                return Object.keys(gCond).some(key => {
                                    if (!sCond[key]) return false;
                                    // Compare values (simple JSON stringify for arrays/objects)
                                    return JSON.stringify(sCond[key]) === JSON.stringify(gCond[key]);
                                });
                            });

                            if (conflicts.length > 0) {
                                return (
                                    <div style={{
                                        marginBottom: 12,
                                        padding: '8px 12px',
                                        background: `${colors.semantic.warning}15`,
                                        border: `1px solid ${colors.semantic.warning}`,
                                        borderRadius: 8,
                                        fontSize: 12,
                                        color: colors.semantic.warningText,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8
                                    }}>
                                        <AlertTriangle size={16} />
                                        <span>
                                            <strong>Overrides Global Rule{conflicts.length > 1 ? 's' : ''}:</strong>{' '}
                                            {conflicts.map(c => c.rule_name).join(', ')}
                                        </span>
                                    </div>
                                );
                            }
                            return null;
                        })()
                    )}

                    {/* APPLICATIONS */}
                    <p
                        style={{
                            margin: '0 0 8px 0',
                            fontSize: 14,
                            color: colors.text.secondary,
                        }}
                    >
                        <strong>Applications: </strong>
                        {(rule.grafana_names || []).map((pattern, idx) =>
                            renderApplicationChip(pattern, idx)
                        )}
                    </p>

                    {/* DESCRIPTION */}
                    {rule.description && (
                        <p
                            style={{
                                margin: 0,
                                fontSize: 13,
                                color: colors.text.secondary,
                                fontStyle: 'italic',
                            }}
                        >
                            {String(rule.description)}
                        </p>
                    )}
                </div>

                {/* ACTION BUTTONS */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                    }}
                >
                    {/* ENABLE / DISABLE */}
                    <button
                        onClick={() => onToggle(rule._id, !Boolean(rule.enabled))}
                        style={{
                                background: rule.enabled
                                    ? colors.semantic.warning
                                    : colors.semantic.success,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            {rule.enabled ? (
                                <ToggleRight size={14} />
                            ) : (
                                <ToggleLeft size={14} />
                            )}
                            {rule.enabled ? 'Disable' : 'Enable'}
                        </button>

                    {/* EDIT */}
                        <button
                            onClick={() => onEdit(rule)}
                            style={{
                                background: colors.semantic.info,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            Edit
                        </button>

                    {/* DELETE */}
                        <button
                            onClick={() => onDelete(rule._id)}
                            style={{
                                background: colors.semantic.error,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            Delete
                        </button>
                </div>
            </div >

            {/* CONDITIONS DISPLAY */}
            < div
                style={{
                    background: gradients.infoGradient,
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 16,
                    border: `2px solid ${colors.semantic.info}`,
                }}
            >
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.semantic.infoText,
                        marginBottom: 12,
                    }}
                >
                    Conditions ({String(rule.logic_operator || 'OR')} Logic)
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
                    {Object.entries(rule.conditions || {}).map(([key, value]) => {
                        if (Array.isArray(value)) {
                            return value.map((v, idx) => (
                                <div
                                    key={`${String(key)}-${idx}`}
                                    style={{
                                        background: colors.bg.secondary,
                                        padding: 8,
                                        borderRadius: 4,
                                        border: `1px solid ${colors.border.secondary}`,
                                        fontSize: 12,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            color: colors.semantic.infoText,
                                        }}
                                    >
                                        {String(key).replace(/_/g, ' ')}:
                                    </span>
                                    <span
                                        style={{
                                            marginLeft: 8,
                                            fontFamily: 'monospace',
                                            color: colors.text.primary,
                                        }}
                                    >
                                        "{String(v)}"
                                    </span>
                                </div>
                            ));
                        }

                        if (value && typeof value === 'string') {
                            const isRegex = String(key).includes('regex');
                            return (
                                <div
                                    key={String(key)}
                                    style={{
                                        background: colors.bg.secondary,
                                        padding: 8,
                                        borderRadius: 4,
                                        border: `1px solid ${colors.border.secondary}`,
                                        fontSize: 12,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontWeight: 600,
                                            color: colors.semantic.infoText,
                                        }}
                                    >
                                        {String(key).replace(/_/g, ' ')}:
                                    </span>

                                    <span
                                        style={{
                                            marginLeft: 8,
                                            fontFamily: 'monospace',
                                            color: colors.text.primary,
                                        }}
                                    >
                                        {isRegex ? `/${String(value)}/` : `"${String(value)}"`}
                                    </span>
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>
            </div >

            {/* OVERRIDES DISPLAY */}
            {
                rule.incident_overrides &&
                Object.keys(rule.incident_overrides).length > 0 && (
                    <div
                        style={{
                            background: gradients.successGradient,
                            padding: 16,
                            borderRadius: 8,
                            marginBottom: 16,
                            border: `2px solid ${colors.semantic.success}`,
                        }}
                    >
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: colors.semantic.successText,
                                marginBottom: 12,
                            }}
                        >
                            Incident Overrides
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns:
                                    'repeat(auto-fit, minmax(250px, 1fr))',
                                gap: 8,
                            }}
                        >
                            {Object.entries(rule.incident_overrides)
                                .filter(([k]) => k !== 'description')
                                .map(([k, v]) => (
                                    <div
                                        key={String(k)}
                                        style={{
                                            background:
                                                k === 'u_system_failure'
                                                    ? colors.semantic.errorBg
                                                    : customFieldsInRule.includes(k)
                                                        ? colors.bg.tertiary
                                                        : colors.bg.secondary,
                                            padding: 8,
                                            borderRadius: 4,
                                            border:
                                                k === 'u_system_failure'
                                                    ? `1px solid ${colors.semantic.error}`
                                                    : customFieldsInRule.includes(k)
                                                        ? `1px solid ${colors.brand.purple}`
                                                        : `1px solid ${colors.semantic.success}`,
                                            fontSize: 12,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontWeight: 600,
                                                color:
                                                    k === 'u_system_failure'
                                                        ? colors.semantic.errorText
                                                        : customFieldsInRule.includes(k)
                                                            ? colors.brand.purple
                                                            : colors.semantic.successText,
                                            }}
                                        >
                                            {String(k).replace(/_/g, ' ')}:
                                        </span>

                                        <div
                                            style={{
                                                marginTop: 4,
                                                color:
                                                    k === 'u_system_failure'
                                                        ? colors.semantic.errorText
                                                        : customFieldsInRule.includes(k)
                                                            ? colors.brand.purple
                                                            : colors.semantic.successText,
                                                fontWeight:
                                                    k === 'u_system_failure' ? 600 : 'normal',
                                            }}
                                        >
                                            {k === 'u_system_failure'
                                                ? v
                                                    ? 'YES'
                                                    : 'NO'
                                                : k === 'assignment_group'
                                                    ? assignmentGroups?.find(g => g.value === v)?.label || v
                                                    : String(v)}
                                        </div>
                                    </div>
                                ))}
                        </div>

                        {/* DESCRIPTION TEMPLATE */}
                        {rule.incident_overrides.description && (
                            <div style={{ marginTop: 12 }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: colors.semantic.successText,
                                        marginBottom: 4,
                                    }}
                                >
                                    Description template:
                                </div>

                                <div
                                    style={{
                                        background: colors.bg.secondary,
                                        border: `1px solid ${colors.semantic.success}`,
                                        borderRadius: 4,
                                        padding: 10,
                                        whiteSpace: 'pre-wrap',
                                        maxHeight: 120,
                                        overflow: 'auto',
                                        fontSize: 11,
                                        color: colors.semantic.successText,
                                    }}
                                >
                                    {String(rule.incident_overrides.description)}
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* META INFO */}
            {
                rule.created_at && (
                    <div
                        style={{
                            paddingTop: 16,
                            borderTop: `1px solid ${colors.border.primary}`,
                            fontSize: 12,
                            color: colors.text.tertiary,
                        }}
                    >
                        Created: {new Date(rule.created_at).toLocaleString()}
                        {rule.updated_at && rule.updated_at !== rule.created_at && (
                            <span>
                                {' '}
                                • Updated:{' '}
                                {new Date(rule.updated_at).toLocaleString()}
                            </span>
                        )}
                    </div>
                )
            }
        </div >
    );
};

export default RuleCard;
