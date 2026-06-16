import React from 'react';
import { PlusCircle, MinusCircle, Lock, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const MappingCustomFields = ({
    customFields,
    requiredFields = {},   // { name: { label, source } } — mandated by the selected offering
    loadingRequired = false,
    errors = {},           // { name: message }
    onAddCustomField,
    onRemoveCustomField,
    onUpdateCustomField
}) => {
    const { colors } = useTheme();

    // Offering-required fields first, then the rest.
    const entries = Object.entries(customFields).sort(([a], [b]) => {
        const ra = requiredFields[a] ? 0 : 1;
        const rb = requiredFields[b] ? 0 : 1;
        return ra - rb;
    });

    const requiredCount = Object.keys(requiredFields).length;

    return (
        <div style={{ padding: 20, background: colors.bg.tertiary, borderRadius: 10, border: `1px solid ${colors.border.primary}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: colors.text.primary, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Additional Custom Fields
                    {loadingRequired && <Loader2 size={14} style={{ color: colors.text.tertiary, animation: 'spin 1s linear infinite' }} />}
                </h4>
                <button
                    type="button"
                    onClick={onAddCustomField}
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

            {requiredCount > 0 && (
                <p style={{ margin: '0 0 14px 0', fontSize: 12, color: colors.text.secondary }}>
                    {requiredCount} field{requiredCount > 1 ? 's are' : ' is'} required by the selected Service Offering and must be filled before saving.
                </p>
            )}

            {entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: colors.text.tertiary, fontSize: 13, fontStyle: 'italic' }}>
                    No custom fields defined.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {entries.map(([key, value]) => {
                        const req = requiredFields[key];
                        const err = errors[key];
                        const borderColor = err ? colors.semantic.error : (req ? colors.brand.primary : colors.border.primary);
                        return (
                            <div key={key} style={{ background: colors.bg.secondary, padding: 12, borderRadius: 8, border: `1px solid ${borderColor}`, position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: colors.text.secondary, fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {key}
                                        {req && <span style={{ color: colors.semantic.error, fontFamily: 'inherit' }}>*</span>}
                                    </label>
                                    {req ? (
                                        <span title={`Required by Service Offering (${req.source === 'data' ? 'data policy' : 'UI policy'})`} style={{ color: colors.text.tertiary, display: 'flex', alignItems: 'center' }}>
                                            <Lock size={12} />
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveCustomField(key)}
                                            style={{ background: 'none', border: 'none', color: colors.text.tertiary, cursor: 'pointer', padding: 0 }}
                                            title="Remove field"
                                        >
                                            <MinusCircle size={14} />
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    value={value}
                                    onChange={(e) => onUpdateCustomField(key, e.target.value)}
                                    placeholder={req ? `${req.label} (required)` : 'Value'}
                                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${err ? colors.semantic.error : colors.border.secondary}`, fontSize: 13, background: colors.bg.primary, color: colors.text.primary }}
                                />
                                {err && <span style={{ color: colors.semantic.error, fontSize: 11, marginTop: 4, display: 'block' }}>{err}</span>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MappingCustomFields;
