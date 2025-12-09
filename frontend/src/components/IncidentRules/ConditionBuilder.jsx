import { Plus, Trash, ArrowDown, Filter } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { CONDITION_FIELDS, CONDITION_OPERATORS } from './constants';

const ConditionBuilder = ({ form, setForm }) => {
    const { colors, gradients } = useTheme();

    const addCondition = () => {
        setForm((prev) => ({
            ...prev,
            conditions: [
                ...prev.conditions,
                {
                    id: Date.now(),
                    field: 'message',
                    operator: 'contains',
                    value: '',
                },
            ],
        }));
    };

    const removeCondition = (id) => {
        setForm((prev) => ({
            ...prev,
            conditions: prev.conditions.filter((c) => c.id !== id),
        }));
    };

    const updateCondition = (id, updates) => {
        setForm((prev) => ({
            ...prev,
            conditions: prev.conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
    };

    return (
        <div
            style={{
                background: gradients.infoGradient,
                padding: 24,
                borderRadius: 12,
                border: `2px solid ${colors.semantic.info}`,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 20,
                }}
            >
                <h4
                    style={{
                        margin: 0,
                        fontSize: 18,
                        fontWeight: 600,
                        color: colors.semantic.infoText,
                    }}
                >
                    WHEN Alert Matches…
                </h4>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    {/* LOGIC SWITCH */}
                    <div
                        style={{
                            display: 'flex',
                            background: colors.bg.secondary,
                            borderRadius: 8,
                            border: `2px solid ${colors.border.secondary}`,
                            overflow: 'hidden',
                        }}
                    >
                        <button
                            type="button"
                            onClick={() =>
                                setForm((p) => ({ ...p, logic_operator: 'OR' }))
                            }
                            style={{
                                background:
                                    form.logic_operator === 'OR'
                                        ? colors.semantic.info
                                        : colors.bg.secondary,
                                color:
                                    form.logic_operator === 'OR'
                                        ? colors.text.inverse
                                        : colors.semantic.infoText,
                                border: 'none',
                                padding: '8px 16px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            OR
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                setForm((p) => ({ ...p, logic_operator: 'AND' }))
                            }
                            style={{
                                background:
                                    form.logic_operator === 'AND'
                                        ? colors.semantic.info
                                        : colors.bg.secondary,
                                color:
                                    form.logic_operator === 'AND'
                                        ? colors.text.inverse
                                        : colors.semantic.infoText,
                                border: 'none',
                                padding: '8px 16px',
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            AND
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={addCondition}
                        style={{
                            background: colors.semantic.success,
                            color: colors.text.inverse,
                            border: 'none',
                            borderRadius: 8,
                            padding: '8px 16px',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                        }}
                    >
                        <Plus size={16} />
                        Add Condition
                    </button>
                </div>
            </div>

            {/* NO CONDITIONS */}
            {form.conditions.length === 0 && (
                <div
                    style={{
                        background: colors.bg.secondary,
                        padding: 32,
                        borderRadius: 8,
                        textAlign: 'center',
                        border: `2px dashed ${colors.border.secondary}`,
                    }}
                >
                    <Filter
                        size={48}
                        color={colors.semantic.info}
                        style={{ marginBottom: 16 }}
                    />
                    <button
                        type="button"
                        onClick={addCondition}
                        style={{
                            background: colors.semantic.info,
                            color: colors.text.inverse,
                            border: 'none',
                            borderRadius: 8,
                            padding: '12px 24px',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Add Your First Condition
                    </button>
                </div>
            )}

            {/* CONDITIONS LIST */}
            {form.conditions.length > 0 && (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                    }}
                >
                    {form.conditions.map((condition, index) => (
                        <div key={String(condition.id)}>
                            <div
                                style={{
                                    background: colors.bg.secondary,
                                    padding: 20,
                                    borderRadius: 8,
                                    border: `2px solid ${colors.semantic.info}`,
                                    position: 'relative',
                                }}
                            >
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: -1,
                                        left: 16,
                                        background: colors.semantic.info,
                                        color: colors.text.inverse,
                                        padding: '4px 12px',
                                        borderRadius: '0 0 8px 8px',
                                        fontSize: 12,
                                        fontWeight: 600,
                                    }}
                                >
                                    Condition {index + 1}
                                </div>

                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr 2fr auto',
                                        gap: 16,
                                        alignItems: 'end',
                                        marginTop: 12,
                                    }}
                                >
                                    {/* FIELD */}
                                    <select
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: `1px solid ${colors.border.secondary}`,
                                            borderRadius: 6,
                                            fontSize: 14,
                                            background: colors.bg.secondary,
                                            color: colors.text.primary,
                                        }}
                                        value={condition.field}
                                        onChange={(e) =>
                                            updateCondition(condition.id, {
                                                field: e.target.value,
                                            })
                                        }
                                    >
                                        {Object.entries(CONDITION_FIELDS).map(
                                            ([key, field]) => (
                                                <option key={String(key)} value={key}>
                                                    {field.label}
                                                </option>
                                            )
                                        )}
                                    </select>

                                    {/* OPERATOR */}
                                    <select
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: `1px solid ${colors.border.secondary}`,
                                            borderRadius: 6,
                                            fontSize: 14,
                                            background: colors.bg.secondary,
                                            color: colors.text.primary,
                                        }}
                                        value={condition.operator}
                                        onChange={(e) =>
                                            updateCondition(condition.id, {
                                                operator: e.target.value,
                                            })
                                        }
                                    >
                                        {Object.entries(CONDITION_OPERATORS).map(
                                            ([key, op]) => (
                                                <option key={String(key)} value={key}>
                                                    {op.label}
                                                </option>
                                            )
                                        )}
                                    </select>

                                    {/* VALUE */}
                                    <input
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            border: `1px solid ${colors.border.secondary}`,
                                            borderRadius: 6,
                                            fontSize: 14,
                                            background: colors.bg.secondary,
                                            color: colors.text.primary,
                                        }}
                                        value={String(condition.value || '')}
                                        onChange={(e) =>
                                            updateCondition(condition.id, {
                                                value: e.target.value,
                                            })
                                        }
                                        placeholder={
                                            CONDITION_FIELDS[condition.field]?.placeholder ||
                                            'Enter value...'
                                        }
                                    />

                                    <button
                                        type="button"
                                        onClick={() => removeCondition(condition.id)}
                                        style={{
                                            background: colors.semantic.error,
                                            color: colors.text.inverse,
                                            border: 'none',
                                            borderRadius: 6,
                                            padding: '8px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Trash size={16} />
                                    </button>
                                </div>
                            </div>

                            {index < form.conditions.length - 1 && (
                                <div
                                    style={{
                                        textAlign: 'center',
                                        padding: '8px 0',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            background:
                                                form.logic_operator === 'OR'
                                                    ? colors.semantic.warningBg
                                                    : colors.semantic.infoBg,
                                            color:
                                                form.logic_operator === 'OR'
                                                    ? colors.semantic.warningText
                                                    : colors.semantic.infoText,
                                            padding: '4px 12px',
                                            borderRadius: 20,
                                            fontSize: 12,
                                            fontWeight: 700,
                                        }}
                                    >
                                        <ArrowDown size={14} />
                                        {form.logic_operator}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ConditionBuilder;
