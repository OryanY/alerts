import React, { useState } from 'react';
import { Plus, X, Search, Zap, Check, Target } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { withAlpha } from '../../utils/formatters';

const MappingFormPatternBuilder = ({
    grafanaNames,
    onPatternsChange,
    PATTERN_TYPES,
    PATTERN_COLORS,
    errors = {}
}) => {
    const { colors } = useTheme();
    const [newPattern, setNewPattern] = useState({ value: '', type: 'exact' });
    const [testInput, setTestInput] = useState('');

    const addPattern = () => {
        const trimmed = newPattern.value.trim();

        if (!trimmed) {
            alert('Please enter a pattern value');
            return;
        }

        // Validate regex BEFORE normalization
        if (newPattern.type === 'regex') {
            try {
                new RegExp(trimmed);
            } catch (e) {
                alert(`Invalid regex pattern: ${e.message}`);
                return;
            }
        }

        if (newPattern.type === 'exact' && !/^[a-z0-9_-]+$/i.test(trimmed)) {
            alert('Exact match can only contain letters, numbers, hyphens, and underscores');
            return;
        }

        const normalizedValue = newPattern.type === 'exact'
            ? trimmed.toLowerCase()
            : trimmed;

        const isDuplicate = grafanaNames.some(
            (p) => {
                const compareValue = p.type === 'exact' ? p.value.toLowerCase() : p.value;
                const compareNew = newPattern.type === 'exact' ? normalizedValue : trimmed;
                return compareValue === compareNew && p.type === newPattern.type;
            }
        );

        if (isDuplicate) {
            alert('This pattern already exists');
            return;
        }

        onPatternsChange([
            ...grafanaNames,
            {
                value: normalizedValue,
                type: newPattern.type,
            },
        ]);
        setNewPattern({ value: '', type: 'exact' });
    };

    const removePattern = (index) => {
        onPatternsChange(grafanaNames.filter((_, i) => i !== index));
    };

    const handlePatternKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addPattern();
        }
    };

    const testPattern = (pattern, input) => {
        if (!input) return false;

        switch (pattern.type) {
            case 'exact':
                return input.toLowerCase() === pattern.value.toLowerCase();

            case 'contains':
                return input.toLowerCase().includes(pattern.value.toLowerCase());

            case 'regex':
                try {
                    const regex = new RegExp(pattern.value, 'i');
                    return regex.test(input);
                } catch {
                    return false;
                }

            default:
                return false;
        }
    };

    const testAllPatterns = () => {
        if (!testInput.trim()) return null;
        const matches = grafanaNames.filter((p) => testPattern(p, testInput));
        return matches.length > 0 ? matches : null;
    };

    const matchResult = testAllPatterns();

    return (
        <div
            style={{
                background: withAlpha(colors.semantic.info, '08'),
                padding: 20,
                borderRadius: 10,
                border: `1px solid ${withAlpha(colors.semantic.info, '30')}`,
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
                <div>
                    <h4
                        style={{
                            margin: '0 0 4px 0',
                            fontSize: 16,
                            fontWeight: 600,
                            color: colors.text.primary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Target size={16} style={{ color: colors.semantic.info }} />
                        Grafana Application Patterns
                    </h4>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            color: colors.text.secondary,
                        }}
                    >
                        Define which Grafana applications should use this mapping
                    </p>
                </div>
            </div>

            {errors.grafana_names && (
                <div style={{ color: colors.semantic.error, fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <X size={14} /> {errors.grafana_names}
                </div>
            )}

            {/* Pattern Input */}
            <div
                style={{
                    background: colors.bg.secondary,
                    padding: 16,
                    borderRadius: 8,
                    border: `1px solid ${colors.border.primary}`,
                    marginBottom: 16,
                }}
            >
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '140px 1fr auto',
                        gap: 12,
                        alignItems: 'end',
                    }}
                >
                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 500,
                                color: colors.text.secondary,
                                marginBottom: 6,
                            }}
                        >
                            Pattern Type
                        </label>
                        <select
                            value={newPattern.type}
                            onChange={(e) =>
                                setNewPattern((prev) => ({ ...prev, type: e.target.value }))
                            }
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: `2px solid ${PATTERN_COLORS[newPattern.type].border}`,
                                borderRadius: 6,
                                fontSize: 13,
                                fontWeight: 500,
                                background: PATTERN_COLORS[newPattern.type].softBg,
                                cursor: 'pointer',
                                color: PATTERN_COLORS[newPattern.type].main,
                            }}
                        >
                            {Object.entries(PATTERN_TYPES).map(([type, info]) => (
                                <option key={type} value={type}>
                                    {info.icon} {info.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label
                            style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 500,
                                color: colors.text.secondary,
                                marginBottom: 6,
                            }}
                        >
                            Pattern Value
                        </label>
                        <input
                            type="text"
                            value={newPattern.value}
                            onChange={(e) =>
                                setNewPattern((prev) => ({ ...prev, value: e.target.value }))
                            }
                            onKeyPress={handlePatternKeyPress}
                            placeholder={PATTERN_TYPES[newPattern.type].placeholder}
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: `1px solid ${colors.border.primary}`,
                                borderRadius: 6,
                                fontSize: 13,
                                background: colors.bg.secondary,
                                color: colors.text.primary,
                                fontFamily: newPattern.type === 'regex' ? 'monospace' : 'inherit',
                            }}
                        />
                    </div>

                    <button
                        type="button"
                        onClick={addPattern}
                        style={{
                            background: colors.semantic.info,
                            color: colors.text.inverse,
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 16px',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <Plus size={14} />
                        Add
                    </button>
                </div>
            </div>

            {/* Pattern List */}
            {grafanaNames.length > 0 ? (
                <div
                    style={{
                        background: colors.bg.secondary,
                        padding: 16,
                        borderRadius: 8,
                        border: `1px solid ${colors.border.primary}`,
                        marginBottom: 16,
                    }}
                >
                    <h5
                        style={{
                            margin: '0 0 12px 0',
                            fontSize: 13,
                            fontWeight: 500,
                            color: colors.text.secondary,
                        }}
                    >
                        Active Patterns ({grafanaNames.length})
                    </h5>

                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                        }}
                    >
                        {grafanaNames.map((pattern, index) => {
                            const colorsForType = PATTERN_COLORS[pattern.type] || PATTERN_COLORS.exact;

                            return (
                                <React.Fragment key={index}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: 10,
                                        background: colorsForType.softBg,
                                        borderRadius: 6,
                                        border: `1px solid ${colorsForType.border}`,
                                    }}
                                >
                                    <span style={{ fontSize: 16 }}>
                                        {PATTERN_TYPES[pattern.type].icon}
                                    </span>

                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 500,
                                                color: colorsForType.main,
                                                marginBottom: 2,
                                            }}
                                        >
                                            {PATTERN_TYPES[pattern.type].label}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 13,
                                                fontFamily:
                                                    pattern.type === 'regex' ? 'monospace' : 'inherit',
                                                color: colors.text.primary,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {pattern.value}
                                        </div>
                                    </div>

                                    {testInput && testPattern(pattern, testInput) && (
                                        <div
                                            style={{
                                                background: colors.semantic.success,
                                                color: colors.text.inverse,
                                                padding: '4px 8px',
                                                borderRadius: 4,
                                                fontSize: 10,
                                                fontWeight: 600,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                            }}
                                        >
                                            <Check size={10} />
                                            MATCH
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => removePattern(index)}
                                        style={{
                                            background: 'transparent',
                                            color: colors.text.secondary,
                                            border: 'none',
                                            borderRadius: 4,
                                            padding: 4,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                {errors[`grafana_names_${index}`] && (
                                    <div style={{ color: colors.semantic.error, fontSize: 11, marginTop: -4, marginLeft: 34 }}>
                                        {errors[`grafana_names_${index}`]}
                                    </div>
                                )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div
                    style={{
                        background: colors.bg.secondary,
                        padding: 24,
                        borderRadius: 8,
                        border: `1px dashed ${colors.border.secondary}`,
                        textAlign: 'center',
                        color: colors.text.secondary,
                        marginBottom: 16,
                    }}
                >
                    <Search
                        size={24}
                        color={colors.text.tertiary}
                        style={{ marginBottom: 8 }}
                    />
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                        }}
                    >
                        No patterns added yet. Add at least one pattern to continue.
                    </p>
                </div>
            )}

            {/* Pattern Tester */}
            <div
                style={{
                    background: withAlpha(colors.brand.yellow, '15'),
                    padding: 16,
                    borderRadius: 8,
                    border: `1px solid ${colors.brand.yellowBorder}`,
                }}
            >
                <h5
                    style={{
                        margin: '0 0 10px 0',
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.text.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                >
                    <Zap size={14} style={{ color: colors.brand.yellowBorder }} />
                    Test Pattern
                </h5>

                <div style={{ display: 'flex', gap: 12, alignItems: 'end' }}>
                    <div style={{ flex: 1 }}>
                        <input
                            type="text"
                            value={testInput}
                            onChange={(e) => setTestInput(e.target.value)}
                            placeholder="e.g. mongodb-prod, db-cache-01"
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: `1px solid ${colors.brand.yellowBorder}`,
                                borderRadius: 6,
                                fontSize: 13,
                                background: colors.bg.secondary,
                                color: colors.text.primary,
                            }}
                        />
                    </div>

                    {matchResult !== null && (
                        <div
                            style={{
                                background: matchResult
                                    ? colors.semantic.success
                                    : colors.semantic.error,
                                color: colors.text.inverse,
                                padding: '8px 14px',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {matchResult ? (
                                <>
                                    <Check size={14} />
                                    Matches {matchResult.length}
                                </>
                            ) : (
                                <>
                                    <X size={14} />
                                    No Match
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MappingFormPatternBuilder;
