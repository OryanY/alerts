import React, { useEffect, useState } from 'react';
import {
    Plus,
    Edit,
    Save,
    PlusCircle,
    MinusCircle,
} from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import { withAlpha, safeJson } from '../../utils/helpers';
import MappingFormPatternBuilder from './MappingFormPatternBuilder';

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

const TemplateHints = ({ colors }) => (
    <div
        style={{
            background: withAlpha(colors.brand.primary, '10'),
            border: `1px solid ${withAlpha(colors.brand.primary, '30')}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            fontSize: 13,
            color: colors.text.secondary,
        }}
    >
        <strong style={{ color: colors.brand.primary, display: 'block', marginBottom: 4 }}>
            💡 Template Variables Available
        </strong>
        You can use dynamic variables in{' '}
        <span style={{ fontWeight: 600 }}>Network</span>,{' '}
        <span style={{ fontWeight: 600 }}>Impact Tech</span>, and{' '}
        <span style={{ fontWeight: 600 }}>Custom Fields</span>:
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
                '{{ application }}',
                '{{ object_name }}',
                '{{ node_name }}',
                '{{ message }}',
                '{{ operator }}',
                '{{ network }}',
                '{{ time_created }}',
            ].map((tag) => (
                <code
                    key={tag}
                    style={{
                        background: colors.bg.primary,
                        border: `1px solid ${colors.border.secondary}`,
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontFamily: 'monospace',
                        color: colors.text.primary,
                    }}
                >
                    {tag}
                </code>
            ))}
        </div>
    </div>
);

const MappingForm = ({
    PATTERN_TYPES,
    PATTERN_COLORS,
    assignmentGroups,
    loadingGroups,
    editingItem,
    onSaved,
    onCancel,
    onError,
}) => {
    const { colors } = useTheme();

    const [form, setForm] = useState({
        grafana_names: [],
        service_offering: '',
        business_service: '',
        u_network: '',
        u_impact_technology: '',
        assignment_group: '',
        u_system_failure: false,
    });

    const [customFields, setCustomFields] = useState({});

    const resetLocal = () => {
        setForm({
            grafana_names: [],
            service_offering: '',
            business_service: '',
            u_network: '',
            u_impact_technology: '',
            assignment_group: '',
            u_system_failure: false,
        });
        setCustomFields({});
    };

    useEffect(() => {
        if (!editingItem) {
            resetLocal();
            return;
        }

        const patterns = (editingItem.grafana_names || []).map((item) => {
            if (typeof item === 'string') {
                return { value: item, type: 'exact' };
            }
            return item;
        });

        const formData = {
            grafana_names: patterns,
            service_offering: editingItem.service_offering || '',
            business_service: editingItem.business_service || '',
            u_network: editingItem.u_network || '',
            u_impact_technology: editingItem.u_impact_technology || '',
            assignment_group: editingItem.assignment_group || '',
            u_system_failure: Boolean(editingItem.u_system_failure),
        };

        setForm(formData);

        const custom = {};
        Object.keys(editingItem).forEach((key) => {
            if (!excludeFromCustom.includes(key)) {
                custom[key] = editingItem[key] || '';
            }
        });

        setCustomFields(custom);
    }, [editingItem]);

    const addCustomField = () => {
        const fieldName = prompt('Enter field name (e.g., u_eck_name, u_oracle_error):');
        if (!fieldName) return;

        const sanitized = fieldName.trim().toLowerCase().replace(/\s+/g, '_');

        if (excludeFromCustom.includes(sanitized)) {
            alert('This field name is reserved or already exists as a base field');
            return;
        }

        if (customFields[sanitized] !== undefined) {
            alert('This custom field already exists');
            return;
        }

        setCustomFields((prev) => ({
            ...prev,
            [sanitized]: '',
        }));
    };

    const removeCustomField = (fieldName) => {
        setCustomFields((prev) => {
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    };

    const updateCustomField = (fieldName, value) => {
        setCustomFields((prev) => ({
            ...prev,
            [fieldName]: value,
        }));
    };

    const validateForm = () => {
        const errors = [];

        if (!form.grafana_names || form.grafana_names.length === 0) {
            errors.push('At least one Grafana application pattern is required');
        }

        form.grafana_names.forEach((pattern, idx) => {
            if (!pattern.value || !pattern.value.trim()) {
                errors.push(`Pattern ${idx + 1}: Value is required`);
            }

            if (pattern.type === 'regex') {
                try {
                    new RegExp(pattern.value);
                } catch (e) {
                    errors.push(`Pattern ${idx + 1}: Invalid regex - ${e.message}`);
                }
            }
        });

        const requiredFields = {
            service_offering: 'Service Offering',
            business_service: 'Business Service',
            u_network: 'Network',
            u_impact_technology: 'Impact Technology',
            assignment_group: 'Assignment Group',
        };

        Object.entries(requiredFields).forEach(([key, label]) => {
            if (!form[key] || !form[key].trim()) {
                errors.push(`${label} is required`);
            }
        });

        return errors;
    };

    const save = async (e) => {
        e.preventDefault();

        const validationErrors = validateForm();
        if (validationErrors.length > 0) {
            const errorMessage = 'Please fix the following errors:\n\n' +
                validationErrors.map((err, i) => `${i + 1}. ${err}`).join('\n');

            onError?.(errorMessage);
            alert(errorMessage);
            return;
        }

        try {
            const dataToSave = {
                ...form,
                ...customFields,
                service_offering: form.service_offering?.trim(),
                business_service: form.business_service?.trim(),
                u_network: form.u_network?.trim(),
                u_impact_technology: form.u_impact_technology?.trim(),
                assignment_group: form.assignment_group?.trim(),
            };

            const url = editingItem
                ? `${API_BASE}/incidents/system-mappings/${editingItem._id}`
                : `${API_BASE}/incidents/system-mappings`;
            const method = editingItem ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSave),
                credentials: 'include'
            });

            const data = await safeJson(res);

            if (data.success) {
                onSaved?.();
            } else {
                onError?.(data.error?.message || 'Failed to save mapping');
            }
        } catch (e2) {
            onError?.('Error saving mapping: ' + e2.message);
        }
    };

    return (
        <div
            style={{
                background: colors.bg.secondary,
                borderRadius: 12,
                padding: 32,
                marginBottom: 32,
                border: `1px solid ${colors.border.primary}`,
                borderTop: `4px solid ${colors.brand.primary}`,
            }}
        >
            <div>
                <h3
                    style={{
                        margin: '0 0 8px 0',
                        fontSize: 20,
                        fontWeight: 600,
                        color: colors.text.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    {editingItem ? (
                        <Edit size={20} style={{ color: colors.brand.primary }} />
                    ) : (
                        <Plus size={20} style={{ color: colors.brand.primary }} />
                    )}
                    {editingItem ? 'Update Mapping' : 'Create New Mapping'}
                </h3>
                <p
                    style={{
                        margin: '0 0 32px 0',
                        color: colors.text.secondary,
                        fontSize: 14,
                    }}
                >
                    {editingItem
                        ? 'Update how these applications create incidents'
                        : 'Configure how alerts from Grafana applications create ServiceNow incidents.'}
                </p>

                <form
                    onSubmit={save}
                    style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
                >
                    {/* Grafana Application Patterns (Decomposed) */}
                    <MappingFormPatternBuilder
                        grafanaNames={form.grafana_names}
                        onPatternsChange={(newPatterns) =>
                            setForm((prev) => ({ ...prev, grafana_names: newPatterns }))
                        }
                        PATTERN_TYPES={PATTERN_TYPES}
                        PATTERN_COLORS={PATTERN_COLORS}
                    />

                    {/* Template Hints */}
                    <TemplateHints colors={colors} />

                    {/* ServiceNow Fields */}
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: 20,
                        }}
                    >
                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: colors.text.secondary,
                                }}
                            >
                                Assignment Group
                            </label>
                            <select
                                value={form.assignment_group}
                                onChange={(e) =>
                                    setForm({ ...form, assignment_group: e.target.value })
                                }
                                disabled={loadingGroups}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: `1px solid ${colors.border.primary}`,
                                    background: colors.bg.primary,
                                    color: colors.text.primary,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            >
                                <option value="">Select Group...</option>
                                {assignmentGroups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: colors.text.secondary,
                                }}
                            >
                                Business Service
                            </label>
                            <input
                                type="text"
                                value={form.business_service}
                                onChange={(e) =>
                                    setForm({ ...form, business_service: e.target.value })
                                }
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: `1px solid ${colors.border.primary}`,
                                    background: colors.bg.primary,
                                    color: colors.text.primary,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: colors.text.secondary,
                                }}
                            >
                                Service Offering
                            </label>
                            <input
                                type="text"
                                value={form.service_offering}
                                onChange={(e) =>
                                    setForm({ ...form, service_offering: e.target.value })
                                }
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: `1px solid ${colors.border.primary}`,
                                    background: colors.bg.primary,
                                    color: colors.text.primary,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: colors.text.secondary,
                                }}
                            >
                                Network
                            </label>
                            <input
                                type="text"
                                value={form.u_network}
                                onChange={(e) =>
                                    setForm({ ...form, u_network: e.target.value })
                                }
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: `1px solid ${colors.border.primary}`,
                                    background: colors.bg.primary,
                                    color: colors.text.primary,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: colors.text.secondary,
                                }}
                            >
                                Impact Technology
                            </label>
                            <input
                                type="text"
                                value={form.u_impact_technology}
                                onChange={(e) =>
                                    setForm({ ...form, u_impact_technology: e.target.value })
                                }
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: 8,
                                    border: `1px solid ${colors.border.primary}`,
                                    background: colors.bg.primary,
                                    color: colors.text.primary,
                                    fontSize: 14,
                                    outline: 'none',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <label
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={form.u_system_failure}
                                    onChange={(e) =>
                                        setForm({ ...form, u_system_failure: e.target.checked })
                                    }
                                    style={{
                                        width: 18,
                                        height: 18,
                                        accentColor: colors.brand.primary,
                                        cursor: 'pointer',
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: colors.text.primary,
                                    }}
                                >
                                    System Failure
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Custom Fields */}
                    <div
                        style={{
                            padding: 20,
                            background: colors.bg.tertiary,
                            borderRadius: 10,
                            border: `1px solid ${colors.border.primary}`,
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 16,
                            }}
                        >
                            <h4
                                style={{
                                    margin: 0,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: colors.text.primary,
                                }}
                            >
                                Additional Custom Fields
                            </h4>
                            <button
                                type="button"
                                onClick={addCustomField}
                                style={{
                                    background: colors.bg.secondary,
                                    border: `1px solid ${colors.border.primary}`,
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: colors.text.primary,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                }}
                            >
                                <PlusCircle size={14} />
                                Add Field
                            </button>
                        </div>

                        {Object.keys(customFields).length === 0 ? (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: 20,
                                    color: colors.text.tertiary,
                                    fontSize: 13,
                                    fontStyle: 'italic',
                                }}
                            >
                                No custom fields defined.
                            </div>
                        ) : (
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                    gap: 12,
                                }}
                            >
                                {Object.entries(customFields).map(([key, value]) => (
                                    <div
                                        key={key}
                                        style={{
                                            background: colors.bg.secondary,
                                            padding: 12,
                                            borderRadius: 8,
                                            border: `1px solid ${colors.border.primary}`,
                                            position: 'relative',
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: 4,
                                            }}
                                        >
                                            <label
                                                style={{
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    color: colors.text.secondary,
                                                    fontFamily: 'monospace',
                                                }}
                                            >
                                                {key}
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => removeCustomField(key)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: colors.text.tertiary,
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                }}
                                                title="Remove field"
                                            >
                                                <MinusCircle size={14} />
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={value}
                                            onChange={(e) => updateCustomField(key, e.target.value)}
                                            placeholder="Value"
                                            style={{
                                                width: '100%',
                                                padding: '6px 10px',
                                                borderRadius: 6,
                                                border: `1px solid ${colors.border.secondary}`,
                                                fontSize: 13,
                                                background: colors.bg.primary,
                                                color: colors.text.primary,
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 12,
                            marginTop: 12,
                            paddingTop: 20,
                            borderTop: `1px solid ${colors.border.secondary}`,
                        }}
                    >
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                background: 'transparent',
                                color: colors.text.secondary,
                                border: 'none',
                                padding: '10px 20px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                background: `linear-gradient(135deg, ${colors.brand.primary} 0%, ${colors.brand.primaryHover} 100%)`,
                                color: colors.text.inverse,
                                border: 'none',
                                borderRadius: 8,
                                padding: '10px 24px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                boxShadow: `0 4px 12px ${withAlpha(colors.brand.primary, '40')}`,
                            }}
                        >
                            <Save size={18} />
                            {editingItem ? 'Update Mapping' : 'Save Mapping'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MappingForm;
