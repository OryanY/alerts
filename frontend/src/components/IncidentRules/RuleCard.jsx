import React, { useMemo } from 'react';
import {
    ToggleLeft,
    ToggleRight,
    AlertTriangle,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { EXCLUDED_MAPPING_FIELDS } from './constants';
import { calculateRuleSpecificity } from '../../utils/ruleSpecificity';
import { useExpandableCard } from '../../hooks/useExpandableCard';

const RuleCard = ({
    rule,
    globalRules,
    assignmentGroups,
    onToggle,
    onEdit,
    onDelete,
    onOpenSimulator,
    renderApplicationChip,
    viewMode,
}) => {
    const { colors, gradients, PATTERN_COLORS } = useTheme();

    const ruleMapping = rule.system_mapping;
    const customFieldsInRule = ruleMapping
        ? Object.keys(ruleMapping).filter(
            (k) => !EXCLUDED_MAPPING_FIELDS.includes(k)
        )
        : [];

    const { isExpanded, isCompact, shouldShowDetails, handleCardClick } = useExpandableCard(viewMode);

    // Possible overlaps with global rules, based on identical condition
    // values. Memoized so re-renders that don't change `rule`/`globalRules`
    // (e.g. an unrelated card toggling, a search term changing) don't redo
    // this scan-and-score work.
    const overlapInfo = useMemo(() => {
        if (rule.is_global) return null;
        const overlaps = (globalRules || []).filter(gRule => {
            if (gRule._id === rule._id) return false;
            const sCond = rule.conditions || {};
            const gCond = gRule.conditions || {};
            return Object.keys(gCond).some(key => {
                if (!sCond[key]) return false;
                return JSON.stringify(sCond[key]) === JSON.stringify(gCond[key]);
            });
        });
        if (overlaps.length === 0) return null;
        return {
            overlaps: overlaps.map((c) => ({ rule_name: c.rule_name, score: calculateRuleSpecificity(c) })),
            myScore: calculateRuleSpecificity(rule),
        };
    }, [rule, globalRules]);

    return (
        <div
            onClick={handleCardClick}
            style={{
                background: colors.bg.secondary,
                borderRadius: 12,
                border: `1px solid ${colors.border.primary}`,
                position: 'relative',
                overflow: 'hidden',
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

            {/* Header Row */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 20px',
                    marginTop: 4,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, flexWrap: 'wrap' }}>
                    {isCompact && (
                        <span style={{ color: colors.text.tertiary, display: 'flex', alignItems: 'center' }}>
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </span>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h4
                                style={{
                                    margin: 0,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: colors.text.primary,
                                }}
                            >
                                {String(rule.rule_name)}
                            </h4>

                            {/* LOGIC BADGE */}
                            <div
                                style={{
                                    background: colors.semantic.infoBg,
                                    color: colors.semantic.infoText,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
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
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600,
                                    }}
                                >
                                    {customFieldsInRule.length} Custom Field
                                    {customFieldsInRule.length > 1 ? 's' : ''}
                                </div>
                            )}

                            {/* STATUS BADGE */}
                            <div
                                style={{
                                    background: rule.enabled
                                        ? colors.semantic.successBg
                                        : colors.bg.tertiary,
                                    color: rule.enabled
                                        ? colors.semantic.successText
                                        : colors.text.secondary,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600,
                                }}
                            >
                                {rule.enabled ? 'ACTIVE' : 'INACTIVE'}
                            </div>
                        </div>

                        {/* Description snippet */}
                        {rule.description && (
                            <span style={{ fontSize: 12, color: colors.text.secondary, fontStyle: 'italic' }}>
                                {String(rule.description).length > 60 ? `${String(rule.description).substring(0, 60)}...` : String(rule.description)}
                            </span>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    {/* Matching patterns (chips) - up to 2 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(rule.grafana_names || []).slice(0, 2).map((pattern, idx) => {
                            const p = typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
                            const colorsForType = PATTERN_COLORS[p.type] || PATTERN_COLORS.exact;
                            return (
                                <span
                                    key={idx}
                                    style={{
                                        background: colors.bg.tertiary,
                                        color: colors.text.primary,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 500,
                                        border: `1px solid ${colors.border.primary}`,
                                        borderLeft: `2px solid ${colorsForType.main}`,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                    }}
                                >
                                    <span>{p.value}</span>
                                </span>
                            );
                        })}
                        {(rule.grafana_names || []).length > 2 && (
                            <span style={{ fontSize: 10, color: colors.text.tertiary, alignSelf: 'center' }}>
                                +{(rule.grafana_names || []).length - 2} more
                            </span>
                        )}
                    </div>

                    {/* Quick Action buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                        <button
                            onClick={() => onToggle(rule._id, !Boolean(rule.enabled))}
                            style={{
                                background: rule.enabled
                                    ? colors.semantic.warning
                                    : colors.semantic.success,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            {rule.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                            {rule.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                            onClick={() => onEdit(rule)}
                            style={{
                                background: colors.semantic.info,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 11,
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                            }}
                        >
                            Edit
                        </button>
                        <button
                            onClick={() => onDelete(rule._id)}
                            style={{
                                background: colors.semantic.error,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 12px',
                                fontSize: 11,
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
                    {/* Possible overlaps with global rules */}
                    <div style={{ marginBottom: 16 }}>
                        {overlapInfo && (
                            <div style={{
                                marginBottom: 12,
                                padding: '8px 12px',
                                background: `${colors.semantic.warning}15`,
                                border: `1px solid ${colors.semantic.warning}`,
                                borderRadius: 8,
                                fontSize: 12,
                                color: colors.semantic.warningText,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: onOpenSimulator ? 6 : 0 }}>
                                    <AlertTriangle size={16} />
                                    <span>
                                        <strong>Possible overlap with global rule{overlapInfo.overlaps.length > 1 ? 's' : ''}:</strong>{' '}
                                        {overlapInfo.overlaps.map(c => `${c.rule_name} (score ${c.score})`).join(', ')}
                                        {' '}vs. this rule's score {overlapInfo.myScore}.
                                    </span>
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.85, marginBottom: onOpenSimulator ? 6 : 0 }}>
                                    Based on identical condition values only — not a guarantee these rules
                                    actually match the same alert. Use the simulator to check a real alert payload.
                                </div>
                                {onOpenSimulator && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onOpenSimulator(); }}
                                        style={{
                                            background: 'none',
                                            border: `1px solid ${colors.semantic.warning}`,
                                            borderRadius: 6,
                                            padding: '3px 8px',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: colors.semantic.warningText,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Open Simulator
                                    </button>
                                )}
                            </div>
                        )}

                        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: colors.text.secondary }}>
                            <strong>Matched Applications: </strong>
                            {(rule.grafana_names || []).map((pattern, idx) =>
                                renderApplicationChip(pattern, idx)
                            )}
                        </p>

                        {rule.description && (
                            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: colors.text.secondary, fontStyle: 'italic' }}>
                                {String(rule.description)}
                            </p>
                        )}
                    </div>

                    {/* CONDITIONS DISPLAY */}
                    <div
                        style={{
                            background: gradients.infoGradient,
                            padding: 16,
                            borderRadius: 8,
                            marginBottom: 16,
                            border: `2px solid ${colors.semantic.info}`,
                        }}
                    >
                        <div style={{ fontSize: 14, fontWeight: 600, color: colors.semantic.infoText, marginBottom: 12 }}>
                            Conditions ({String(rule.logic_operator || 'OR')} Logic)
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                            <span style={{ fontWeight: 600, color: colors.semantic.infoText }}>
                                                {String(key).replace(/_/g, ' ')}:
                                            </span>
                                            <span style={{ marginLeft: 8, fontFamily: 'monospace', color: colors.text.primary }}>
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
                                            <span style={{ fontWeight: 600, color: colors.semantic.infoText }}>
                                                {String(key).replace(/_/g, ' ')}:
                                            </span>
                                            <span style={{ marginLeft: 8, fontFamily: 'monospace', color: colors.text.primary }}>
                                                {isRegex ? `/${String(value)}/` : `"${String(value)}"`}
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>

                    {/* OVERRIDES DISPLAY */}
                    {rule.incident_overrides && Object.keys(rule.incident_overrides).length > 0 && (
                        <div
                            style={{
                                background: gradients.successGradient,
                                padding: 16,
                                borderRadius: 8,
                                marginBottom: 16,
                                border: `2px solid ${colors.semantic.success}`,
                            }}
                        >
                            <div style={{ fontSize: 14, fontWeight: 600, color: colors.semantic.successText, marginBottom: 12 }}>
                                Incident Overrides
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                                {Object.entries(rule.incident_overrides)
                                    .filter(([k]) => k !== 'description')
                                    .map(([k, v]) => (
                                        <div
                                            key={String(k)}
                                            style={{
                                                background: k === 'u_system_failure'
                                                    ? colors.semantic.errorBg
                                                    : customFieldsInRule.includes(k)
                                                        ? colors.bg.tertiary
                                                        : colors.bg.secondary,
                                                padding: 8,
                                                borderRadius: 4,
                                                border: k === 'u_system_failure'
                                                    ? `1px solid ${colors.semantic.error}`
                                                    : customFieldsInRule.includes(k)
                                                        ? `1px solid ${colors.brand.purple}`
                                                        : `1px solid ${colors.semantic.success}`,
                                                fontSize: 12,
                                            }}
                                        >
                                            <span style={{
                                                fontWeight: 600,
                                                color: k === 'u_system_failure'
                                                    ? colors.semantic.errorText
                                                    : customFieldsInRule.includes(k)
                                                        ? colors.brand.purple
                                                        : colors.semantic.successText,
                                            }}>
                                                {String(k).replace(/_/g, ' ')}:
                                            </span>
                                            <div style={{
                                                marginTop: 4,
                                                color: k === 'u_system_failure'
                                                    ? colors.semantic.errorText
                                                    : customFieldsInRule.includes(k)
                                                        ? colors.brand.purple
                                                        : colors.semantic.successText,
                                                fontWeight: k === 'u_system_failure' ? 600 : 'normal',
                                            }}>
                                                {k === 'u_system_failure'
                                                    ? v ? 'YES' : 'NO'
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
                                    <div style={{ fontSize: 12, fontWeight: 600, color: colors.semantic.successText, marginBottom: 4 }}>
                                        Description template:
                                    </div>
                                    <div style={{
                                        background: colors.bg.secondary,
                                        border: `1px solid ${colors.semantic.success}`,
                                        borderRadius: 4,
                                        padding: 10,
                                        whiteSpace: 'pre-wrap',
                                        maxHeight: 120,
                                        overflow: 'auto',
                                        fontSize: 11,
                                        color: colors.semantic.successText,
                                    }}>
                                        {String(rule.incident_overrides.description)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* META INFO */}
                    {rule.created_at && (
                        <div style={{ paddingTop: 16, borderTop: `1px solid ${colors.border.primary}`, fontSize: 11, color: colors.text.tertiary }}>
                            Created: {new Date(rule.created_at).toLocaleString()}
                            {rule.updated_at && rule.updated_at !== rule.created_at && (
                                <span> • Updated: {new Date(rule.updated_at).toLocaleString()}</span>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default React.memo(RuleCard);
