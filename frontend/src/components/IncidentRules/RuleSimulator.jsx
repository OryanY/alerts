
import React, { useState } from 'react';
import { API_BASE } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import { Play, AlertTriangle, CheckCircle, Info, ChevronRight, ChevronDown } from 'lucide-react';
import LabeledInput from '../ui/LabeledInput';
import { safeJson } from '../../utils/api';

const RuleSimulator = ({ onClose }) => {
    const { colors, gradients } = useTheme();

    const [formData, setFormData] = useState({
        application: '',
        message: '',
        node_name: '',
        object_name: '',
        operator: '',
        network: ''
    });

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.application) {
            setError("Application name is required");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch(`${API_BASE}/incidents/incident/simulate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                credentials: 'include'
            });

            const data = await safeJson(res);

            if (data.success) {
                setResult(data.data);
            } else {
                setError(data.error?.message || 'Simulation failed');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            background: colors.bg.secondary,
            borderRadius: 12,
            border: `1px solid ${colors.border.primary}`,
            marginBottom: 24,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 24px',
                borderBottom: `1px solid ${colors.border.primary}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: colors.bg.tertiary
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ padding: 8, background: `${colors.brand.primary}20`, borderRadius: 8 }}>
                        <Play size={20} color={colors.brand.primary} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text.primary }}>
                            Rule Simulator
                        </h3>
                        <p style={{ margin: 0, fontSize: 12, color: colors.text.tertiary }}>
                            Test your rules safely without creating real incidents
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: colors.text.tertiary,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600
                    }}
                >
                    Close
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', minHeight: 400 }}>
                {/* Input Form */}
                <div style={{
                    padding: 24,
                    borderRight: `1px solid ${colors.border.primary}`,
                    background: colors.bg.secondary
                }}>
                    <h4 style={{ margin: '0 0 16px 0', fontSize: 14, fontWeight: 600, color: colors.text.secondary }}>
                        Alert Payload
                    </h4>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <LabeledInput
                            label="Application Name *"
                            value={formData.application}
                            onChange={(v) => setFormData({ ...formData, application: v })}
                            placeholder="e.g. MyService"
                        />

                        <LabeledInput
                            label="Message"
                            value={formData.message}
                            onChange={(v) => setFormData({ ...formData, message: v })}
                            placeholder="Error message content..."
                        />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <LabeledInput
                                label="Node"
                                value={formData.node_name}
                                onChange={(v) => setFormData({ ...formData, node_name: v })}
                                placeholder="server-01"
                            />
                            <LabeledInput
                                label="Object"
                                value={formData.object_name}
                                onChange={(v) => setFormData({ ...formData, object_name: v })}
                                placeholder="CPU"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <LabeledInput
                                label="Operator"
                                value={formData.operator}
                                onChange={(v) => setFormData({ ...formData, operator: v })}
                                placeholder="NOC"
                            />
                            <LabeledInput
                                label="Network"
                                value={formData.network}
                                onChange={(v) => setFormData({ ...formData, network: v })}
                                placeholder="Internal"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: 8,
                                padding: '12px',
                                background: colors.brand.primary,
                                color: 'white',
                                border: 'none',
                                borderRadius: 8,
                                fontWeight: 600,
                                cursor: loading ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            {loading ? 'Simulating...' : (
                                <>
                                    <Play size={16} fill="currentColor" />
                                    Run Simulation
                                </>
                            )}
                        </button>

                        {error && (
                            <div style={{
                                padding: 12,
                                background: `${colors.semantic.error}15`,
                                color: colors.semantic.error,
                                borderRadius: 8,
                                fontSize: 13,
                                display: 'flex',
                                gap: 8,
                                alignItems: 'center'
                            }}>
                                <AlertTriangle size={16} />
                                {error}
                            </div>
                        )}
                    </form>
                </div>

                {/* Results Area */}
                <div style={{ padding: 24, background: colors.bg.primary, overflowY: 'auto' }}>
                    {!result ? (
                        <div style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: colors.text.tertiary,
                            gap: 16
                        }}>
                            <div style={{
                                width: 64, height: 64,
                                borderRadius: '50%',
                                background: colors.bg.tertiary,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Play size={32} opacity={0.3} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                Type alert details and click Run to see<br />which rules will execute.
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* WINNER SECTION */}
                            <div style={{
                                padding: 20,
                                borderRadius: 12,
                                background: result.winner
                                    ? `${colors.semantic.success}15`
                                    : colors.bg.secondary,
                                border: `1px solid ${result.winner ? colors.semantic.success : colors.border.primary}`
                            }}>
                                <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
                                    {result.winner ? (
                                        <>
                                            <CheckCircle size={20} color={colors.semantic.success} />
                                            <span style={{ color: colors.semantic.success }}>Matched Rule Found</span>
                                        </>
                                    ) : (
                                        <>
                                            <Info size={20} color={colors.text.secondary} />
                                            <span>No Custom Rules Matched</span>
                                        </>
                                    )}
                                </h4>

                                {result.winner ? (
                                    <div>
                                        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                                            {result.winner.rule.rule_name}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                            {result.winner.is_global ? (
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700,
                                                    background: colors.brand.primary, color: 'white',
                                                    padding: '2px 8px', borderRadius: 4
                                                }}>GLOBAL</span>
                                            ) : (
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700,
                                                    background: colors.brand.secondary, color: 'white',
                                                    padding: '2px 8px', borderRadius: 4
                                                }}>SPECIFIC</span>
                                            )}
                                            <span style={{ fontSize: 12, color: colors.text.tertiary }}>
                                                Score: {result.winner.score}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 13, color: colors.text.secondary, lineHeight: 1.5 }}>
                                            <strong>Actions:</strong>
                                            <pre style={{ margin: '8px 0 0 0', background: colors.bg.primary, padding: 8, borderRadius: 6, fontSize: 12 }}>
                                                {JSON.stringify(result.winner.rule.incident_overrides, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: colors.text.secondary, fontSize: 14 }}>
                                        No specific or global rules matched this alert. The system will use the default System Mapping configuration.
                                    </div>
                                )}
                            </div>

                            {/* SHADOWED RULES */}
                            {result.shadowed_rules && result.shadowed_rules.length > 0 && (
                                <div>
                                    <h4 style={{ fontSize: 13, fontWeight: 600, color: colors.text.tertiary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                        Shadowed Rules (Overridden)
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {result.shadowed_rules.map((match, idx) => (
                                            <div key={idx} style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                background: colors.bg.secondary,
                                                border: `1px solid ${colors.border.primary}`,
                                                opacity: 0.7,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 14, color: colors.text.secondary }}>
                                                        {match.rule.rule_name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                                        <span style={{
                                                            fontSize: 11,
                                                            background: match.is_global ? colors.brand.primary : colors.brand.secondary,
                                                            color: 'white', padding: '1px 6px', borderRadius: 4
                                                        }}>
                                                            {match.is_global ? 'GLOBAL' : 'SPECIFIC'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 12, color: colors.text.tertiary, textAlign: 'right' }}>
                                                    Score: {match.score}<br />
                                                    (Did not win)
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* HIEDRARCHY EXPLANATION */}
                            <div style={{ padding: 16, background: `${colors.semantic.infoBg}40`, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: colors.semantic.info, marginBottom: 8 }}>
                                    Evaluation Order:
                                </div>
                                {result.hierarchy_explanation.map((line, i) => (
                                    <div key={i} style={{ fontSize: 12, color: colors.text.secondary, marginBottom: 4 }}>
                                        {line}
                                    </div>
                                ))}
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RuleSimulator;
