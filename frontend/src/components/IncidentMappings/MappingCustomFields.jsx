import React from 'react';
import { PlusCircle, MinusCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const MappingCustomFields = ({
    customFields,
    onAddCustomField,
    onRemoveCustomField,
    onUpdateCustomField
}) => {
    const { colors } = useTheme();

    return (
        <div style={{ padding: 20, background: colors.bg.tertiary, borderRadius: 10, border: `1px solid ${colors.border.primary}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: colors.text.primary }}>
                    Additional Custom Fields
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

            {Object.keys(customFields).length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: colors.text.tertiary, fontSize: 13, fontStyle: 'italic' }}>
                    No custom fields defined.
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                    {Object.entries(customFields).map(([key, value]) => (
                        <div key={key} style={{ background: colors.bg.secondary, padding: 12, borderRadius: 8, border: `1px solid ${colors.border.primary}`, position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: colors.text.secondary, fontFamily: 'monospace' }}>
                                    {key}
                                </label>
                                <button
                                    type="button"
                                    onClick={() => onRemoveCustomField(key)}
                                    style={{ background: 'none', border: 'none', color: colors.text.tertiary, cursor: 'pointer', padding: 0 }}
                                    title="Remove field"
                                >
                                    <MinusCircle size={14} />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => onUpdateCustomField(key, e.target.value)}
                                placeholder="Value"
                                style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: `1px solid ${colors.border.secondary}`, fontSize: 13, background: colors.bg.primary, color: colors.text.primary }}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MappingCustomFields;
