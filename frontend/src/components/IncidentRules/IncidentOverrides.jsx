import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Globe } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import SearchableSelect from '../common/SearchableSelect';

const IncidentOverrides = ({ form, setForm, selectedMapping, customFieldsInMapping, assignmentGroups }) => {
    const { colors, gradients } = useTheme();

    // Define all available fields based on standard set + custom fields from mapping
    const availableFields = useMemo(() => {
        const standard = [
            { key: 'short_description', label: 'Short Description', placeholder: 'Alert: {{object_name}} on {{node_name}}' },
            { key: 'assignment_group', label: 'Assignment Group', type: 'select', options: assignmentGroups },
            { key: 'service_offering', label: 'Service Offering', placeholder: 'Override service offering' },
            { key: 'business_service', label: 'Business Service', placeholder: 'Override business service' },
            { key: 'u_network', label: 'Network', placeholder: 'Override network (e.g., PROD, QA)' },
            { key: 'u_impact_technology', label: 'Impact Technology', placeholder: 'Override impact technology' },
            { key: 'u_operational_impact', label: 'Operational Impact', placeholder: 'Override operational impact (default: בבדיקה)' },
            { key: 'u_system_failure', label: 'System Failure', type: 'checkbox' },
            { key: 'description', label: 'Description (Full)', type: 'textarea', placeholder: 'Full incident description...' }
        ];

        const custom = (customFieldsInMapping || []).map(field => ({
            key: field,
            label: field,
            isCustom: true,
            placeholder: `Override ${field} value`
        }));

        return [...standard, ...custom];
    }, [customFieldsInMapping, assignmentGroups]);

    // Fields that are currently being overridden
    const activeOverrideKeys = Object.keys(form.incident_overrides || {});

    // Fields available to add (not yet overridden)
    const unusedFields = availableFields.filter(f => !activeOverrideKeys.includes(f.key));

    const addOverride = (key) => {
        setForm(prev => ({
            ...prev,
            incident_overrides: {
                ...prev.incident_overrides,
                [key]: key === 'u_system_failure' ? false : '' // Default empty value
            }
        }));
    };

    const removeOverride = (key) => {
        setForm(prev => {
            const newOverrides = { ...prev.incident_overrides };
            delete newOverrides[key];
            return {
                ...prev,
                incident_overrides: newOverrides
            };
        });
    };

    // Component for adding new overrides
    const AddOverrideDropdown = () => {
        const [isOpen, setIsOpen] = useState(false);
        const btnRef = React.useRef(null);
        const [dropStyle, setDropStyle] = useState({});

        if (unusedFields.length === 0) return null;

        const openDropdown = () => {
            if (!btnRef.current) return;
            const rect = btnRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropH = Math.min(unusedFields.length * 44, 280);

            if (spaceBelow < dropH + 16) {
                // Open upward
                setDropStyle({
                    position: 'fixed',
                    bottom: window.innerHeight - rect.top + 4,
                    left: rect.left,
                    width: Math.max(rect.width, 240),
                    zIndex: 9999,
                    maxHeight: 280,
                    overflowY: 'auto',
                });
            } else {
                // Open downward
                setDropStyle({
                    position: 'fixed',
                    top: rect.bottom + 4,
                    left: rect.left,
                    width: Math.max(rect.width, 240),
                    zIndex: 9999,
                    maxHeight: 280,
                    overflowY: 'auto',
                });
            }
            setIsOpen(true);
        };

        return (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
                <button
                    ref={btnRef}
                    type="button"
                    onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
                    style={{
                        background: colors.bg.secondary,
                        color: colors.brand.primary,
                        border: `1px dashed ${colors.brand.primary}`,
                        borderRadius: 8,
                        padding: '10px 16px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s ease',
                    }}
                >
                    <Plus size={16} />
                    Add Field to Override
                </button>

                {isOpen && (
                    <>
                        <div
                            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                            onClick={() => setIsOpen(false)}
                        />
                        <div
                            style={{
                                ...dropStyle,
                                background: colors.bg.primary,
                                border: `1px solid ${colors.border.primary}`,
                                borderRadius: 8,
                                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            }}
                        >
                            {unusedFields.map(field => (
                                <button
                                    key={field.key}
                                    type="button"
                                    onClick={() => {
                                        addOverride(field.key);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '10px 16px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: colors.text.primary,
                                        fontSize: 14,
                                        cursor: 'pointer',
                                        borderBottom: `1px solid ${colors.border.secondary}`
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = colors.bg.secondary}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    {field.label} {field.isCustom && <span style={{ fontSize: 11, opacity: 0.6 }}>(Custom)</span>}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>
        );
    };

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

            {/* Template Hints */}
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
                        fontSize: 13,
                        color: colors.semantic.successText,
                        fontWeight: 500,
                        lineHeight: 1.6
                    }}
                >
                    💡 Template Variables:
                    {['{{ application }}', '{{ object_name }}', '{{ node_name }}', '{{ message }}'].map(tag => (
                        <code
                            key={tag}
                            style={{
                                background: colors.semantic.successBg,
                                padding: '2px 6px',
                                borderRadius: 4,
                                margin: '0 4px',
                                fontSize: 12
                            }}
                        >
                            {tag}
                        </code>
                    ))}
                </p>
            </div>

            {!selectedMapping && !form.is_global && (
                <div
                    style={{
                        background: colors.semantic.warningBg,
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid ${colors.semantic.warning}`,
                        marginBottom: 20,
                        fontSize: 13,
                        color: colors.semantic.warningText,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    <span style={{ fontSize: 16 }}>⚠️</span> Select a system mapping first to see available fields and base values
                </div>
            )}

            {form.is_global && (
                <div
                    style={{
                        background: colors.bg.secondary,
                        padding: 12,
                        borderRadius: 8,
                        border: `1px dashed ${colors.border.secondary}`,
                        marginBottom: 20,
                        fontSize: 13,
                        color: colors.text.secondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                    }}
                >
                    <Globe size={16} /> Global Rule: No base mapping values available.
                </div>
            )}

            {/* Active Overrides List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
                {activeOverrideKeys.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 30,
                        color: colors.text.secondary,
                        fontStyle: 'italic',
                        border: `1px dashed ${colors.border.secondary}`,
                        borderRadius: 8
                    }}>
                        No overrides active. The incident will use defaults from the System Mapping.
                    </div>
                ) : (
                    activeOverrideKeys.map(key => {
                        const fieldConfig = availableFields.find(f => f.key === key) || {
                            label: key,
                            placeholder: `Override ${key}`,
                            isCustom: true
                        };

                        return (
                            <div
                                key={key}
                                style={{
                                    background: colors.bg.secondary,
                                    padding: 16,
                                    borderRadius: 8,
                                    border: `1px solid ${colors.border.primary}`,
                                    position: 'relative',
                                    animation: 'fadeIn 0.2s ease-in-out',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: colors.text.primary }}>
                                        {fieldConfig.label}
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => removeOverride(key)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: colors.semantic.error,
                                            cursor: 'pointer',
                                            padding: 4,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            fontSize: 12,
                                            opacity: 0.8
                                        }}
                                        title="Remove override"
                                    >
                                        <Trash2 size={14} /> Remove
                                    </button>
                                </div>

                                {fieldConfig.type === 'textarea' ? (
                                    <textarea
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: `1px solid ${colors.border.secondary}`,
                                            borderRadius: 6,
                                            fontSize: 14,
                                            background: colors.bg.primary,
                                            color: colors.text.primary,
                                            minHeight: 80,
                                            fontFamily: 'inherit'
                                        }}
                                        value={form.incident_overrides[key] || ''}
                                        onChange={(e) => setForm(p => ({
                                            ...p,
                                            incident_overrides: { ...p.incident_overrides, [key]: e.target.value }
                                        }))}
                                        placeholder={fieldConfig.placeholder}
                                    />
                                ) : fieldConfig.type === 'select' ? (
                                    <SearchableSelect
                                        options={fieldConfig.options || []}
                                        value={form.incident_overrides[key] || ''}
                                        onChange={(val) => setForm(p => ({
                                            ...p,
                                            incident_overrides: { ...p.incident_overrides, [key]: val }
                                        }))}
                                        placeholder="Select Option..."
                                    />
                                ) : fieldConfig.type === 'checkbox' ? (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={form.incident_overrides[key] === true}
                                            onChange={(e) => setForm(p => ({
                                                ...p,
                                                incident_overrides: { ...p.incident_overrides, [key]: e.target.checked }
                                            }))}
                                            style={{ width: 16, height: 16, accentColor: colors.brand.primary }}
                                        />
                                        <span style={{ fontSize: 13, color: colors.text.secondary }}>
                                            Enable System Failure Outage
                                        </span>
                                    </label>
                                ) : (
                                    <input
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            border: `1px solid ${colors.border.secondary}`,
                                            borderRadius: 6,
                                            fontSize: 14,
                                            background: colors.bg.primary,
                                            color: colors.text.primary
                                        }}
                                        value={form.incident_overrides[key] || ''}
                                        onChange={(e) => setForm(p => ({
                                            ...p,
                                            incident_overrides: { ...p.incident_overrides, [key]: e.target.value }
                                        }))}
                                        placeholder={fieldConfig.placeholder}
                                    />
                                )}

                                {/* Base Value Hint */}
                                {selectedMapping && (
                                    <div style={{ marginTop: 6, fontSize: 11, color: colors.text.tertiary, display: 'flex', gap: 6 }}>
                                        <span>📋 Base Value:</span>
                                        <strong style={{ fontFamily: 'monospace', color: colors.text.secondary }}>
                                            {fieldConfig.key === 'u_system_failure'
                                                ? (selectedMapping[fieldConfig.key] ? 'YES' : 'NO')
                                                : (selectedMapping[fieldConfig.key] || '—')
                                            }
                                        </strong>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <AddOverrideDropdown />
        </div>
    );
};

export default IncidentOverrides;
