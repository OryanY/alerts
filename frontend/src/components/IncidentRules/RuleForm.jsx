import { Edit, Plus, Eye } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import ConditionBuilder from './ConditionBuilder';
import IncidentOverrides from './IncidentOverrides';
import { regexError, findDuplicate } from '../../utils/formValidation';

const RuleForm = ({
    form,
    setForm,
    save,
    reset,
    setShowForm,
    editingItem,
    previewMode,
    setPreviewMode,
    mappings,
    assignmentGroups,
    selectedMapping,
    customFieldsInMapping,
    existingRules = [],
}) => {
    const { colors, gradients } = useTheme();

    const validateForm = () => {
        const errors = [];
        if (!form.is_global && !form.system_mapping_id) errors.push('Base System Mapping is required');
        if (!form.rule_name?.trim()) errors.push('Rule Name is required');
        if (!form.conditions || form.conditions.length === 0) errors.push('At least one condition is required');

        // Validate conditions content, and regex syntax specifically (mirrors the
        // backend's own new RegExp(...) call — an invalid pattern here would
        // otherwise only surface as "this rule silently never matches").
        form.conditions.forEach((c, idx) => {
            if (!c.value || !String(c.value).trim()) {
                errors.push(`Condition ${idx + 1}: Value is missing`);
                return;
            }
            if (c.operator === 'regex') {
                const err = regexError(c.value);
                if (err) errors.push(`Condition ${idx + 1}: ${err}`);
            }
        });

        // Duplicate rule name (case-insensitive), excluding the rule being edited.
        const normalizedName = form.rule_name?.trim().toLowerCase();
        if (normalizedName) {
            const duplicate = findDuplicate(
                existingRules,
                (r) => r.rule_name?.trim().toLowerCase() === normalizedName,
                editingItem?._id
            );
            if (duplicate) errors.push(`A rule named "${form.rule_name.trim()}" already exists`);
        }

        return errors;
    };

    const handleSave = (e) => {
        e.preventDefault();
        const errors = validateForm();

        if (errors.length > 0) {
            // Simple alert for now, could be a toast or inline error
            alert('Please fix the following errors:\n' + errors.join('\n'));
            return;
        }

        save(e);
    };

    return (
        <div
            id="rule-form"
            style={{
                background: colors.bg.secondary,
                borderRadius: 16,
                padding: 32,
                marginBottom: 32,
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
                    height: 6,
                    background: gradients.headerBarGradient,
                }}
            />

            <div style={{ marginTop: 8 }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 24,
                    }}
                >
                    <div>
                        <h3
                            style={{
                                margin: '0 0 8px 0',
                                fontSize: 24,
                                fontWeight: 700,
                                color: colors.text.primary,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                            }}
                        >
                            {editingItem ? <Edit size={24} /> : <Plus size={24} />}
                            {editingItem ? 'Update Rule' : 'Create Rule'}
                        </h3>

                        <p
                            style={{
                                margin: 0,
                                color: colors.text.secondary,
                                fontSize: 16,
                            }}
                        >
                            Set up conditions for when this rule should trigger
                        </p>
                    </div>

                    <button
                        type="button"
                        style={{
                            background: previewMode ? colors.semantic.success : colors.bg.secondary,
                            color: previewMode ? colors.text.inverse : colors.text.secondary,
                            border: `2px solid ${colors.border.secondary}`,
                            borderRadius: 8,
                            padding: '8px 16px',
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                        onClick={() => setPreviewMode((prev) => !prev)}
                    >
                        <Eye size={14} />
                        {previewMode ? 'Hide Preview' : 'Show Preview'}
                    </button>
                </div>

                <form
                    onSubmit={handleSave}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 32,
                    }}
                >
                    {/* BASIC INFO */}
                    <div
                        style={{
                            background: gradients.neutralSoftGradient,
                            padding: 24,
                            borderRadius: 12,
                            border: `2px solid ${colors.border.secondary}`,
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h4
                                style={{
                                    margin: 0,
                                    fontSize: 18,
                                    fontWeight: 600,
                                    color: colors.text.primary,
                                }}
                            >
                                Rule Setup
                            </h4>

                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    cursor: 'pointer',
                                    userSelect: 'none'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={form.is_global}
                                    onChange={() => setForm(p => ({ ...p, is_global: !p.is_global, system_mapping_id: !p.is_global ? '' : p.system_mapping_id }))}
                                    style={{ width: 16, height: 16, accentColor: colors.brand.primary }}
                                />
                                <span style={{ fontSize: 13, fontWeight: 500, color: colors.text.primary }}>
                                    Global Rule <span style={{ color: colors.text.secondary, fontWeight: 400 }}>(Applies to all apps)</span>
                                </span>
                            </label>
                        </div>

                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                                gap: 20,
                            }}
                        >
                            {/* SYSTEM MAPPING (Only if NOT global) */}
                            {!form.is_global && (
                                <div>
                                    <label
                                        style={{
                                            display: 'block',
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: colors.text.primary,
                                            marginBottom: 8,
                                        }}
                                    >
                                        Base System Mapping *
                                    </label>
                                    <select
                                        style={{
                                            width: '100%',
                                            padding: '12px 16px',
                                            border: `2px solid ${colors.border.secondary}`,
                                            borderRadius: 8,
                                            fontSize: 14,
                                            background: colors.bg.secondary,
                                            color: colors.text.primary,
                                        }}
                                        required
                                        value={form.system_mapping_id}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                system_mapping_id: e.target.value,
                                            }))
                                        }
                                    >
                                        <option value="">Choose a system mapping...</option>

                                        {mappings.map((m) => (
                                            <option key={String(m._id)} value={m._id}>
                                                {m.grafana_names
                                                    ?.map((name) =>
                                                        typeof name === 'object' ? name.value : name
                                                    )
                                                    .join(', ')}{' '}
                                                ← {m.service_offering_label || m.service_offering}
                                            </option>
                                        ))}
                                    </select>

                                    {selectedMapping && (
                                        <div
                                            style={{
                                                marginTop: 8,
                                                fontSize: 12,
                                                color: colors.text.secondary,
                                            }}
                                        >
                                            Applies to:{' '}
                                            <strong>
                                                {(selectedMapping.grafana_names || []).map((g) =>
                                                    typeof g === 'string' ? g : g.value
                                                ).join(', ')}
                                            </strong>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* RULE NAME */}
                            <div>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: colors.text.primary,
                                        marginBottom: 8,
                                    }}
                                >
                                    Rule Name *
                                </label>
                                <input
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: `2px solid ${colors.border.secondary}`,
                                        borderRadius: 8,
                                        fontSize: 14,
                                        background: colors.bg.secondary,
                                        color: colors.text.primary,
                                    }}
                                    required
                                    value={form.rule_name}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            rule_name: e.target.value,
                                        }))
                                    }
                                    placeholder="e.g., ECK High CPU Alerts"
                                />
                            </div>

                            {/* DESCRIPTION */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label
                                    style={{
                                        display: 'block',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: colors.text.primary,
                                        marginBottom: 8,
                                    }}
                                >
                                    Description
                                </label>
                                <input
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        border: `2px solid ${colors.border.secondary}`,
                                        borderRadius: 8,
                                        fontSize: 14,
                                        background: colors.bg.secondary,
                                        color: colors.text.primary,
                                    }}
                                    value={String(form.description || '')}
                                    onChange={(e) =>
                                        setForm((p) => ({
                                            ...p,
                                            description: e.target.value,
                                        }))
                                    }
                                    placeholder="Describe when this rule triggers…"
                                />
                            </div>
                        </div>
                    </div>

                    <ConditionBuilder form={form} setForm={setForm} />

                    <IncidentOverrides
                        form={form}
                        setForm={setForm}
                        selectedMapping={selectedMapping}
                        customFieldsInMapping={customFieldsInMapping}
                        assignmentGroups={assignmentGroups}
                    />

                    {/* ACTION BUTTONS */}
                    <div
                        style={{
                            display: 'flex',
                            gap: 16,
                            justifyContent: 'flex-end',
                            paddingTop: 24,
                            borderTop: `2px solid ${colors.border.primary}`,
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => {
                                reset();
                                setShowForm(false);
                            }}
                            style={{
                                background: colors.bg.secondary,
                                color: colors.text.secondary,
                                border: `2px solid ${colors.border.secondary}`,
                                borderRadius: 8,
                                padding: '12px 24px',
                                fontSize: 16,
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            style={{
                                background: colors.brand.purple,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 8,
                                padding: '12px 32px',
                                fontSize: 16,
                                fontWeight: 600,
                                cursor: 'pointer',
                                opacity: form.conditions.length === 0 ? 0.5 : 1,
                            }}
                            disabled={form.conditions.length === 0}
                        >
                            {editingItem ? '✓ Update Rule' : '🚀 Create Rule'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleForm;
