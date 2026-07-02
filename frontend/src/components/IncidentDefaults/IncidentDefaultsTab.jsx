import { useEffect, useMemo, useState, useCallback } from 'react';
import { Save, RotateCcw, Plus, Trash2, RefreshCw, KeyRound } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { fetchApi, authHeaders } from '../../utils/api';
import { useAuthGate } from '../../hooks/useAuthGate';

// Editor for the incident field configuration stored in Mongo
// (content templates + mandatory-field fillers).
// Changes apply to the next incident immediately — no pod restart.
// Saving requires the team key (X-Settings-Key) when the backend has
// INCIDENT_SETTINGS_KEY configured.

const SECTION_KEYS = ['content_templates', 'default_fields'];
const TEAM_KEY_STORAGE = 'incident_settings_key';

const entriesOf = (obj) => Object.entries(obj || {});

const IncidentDefaultsTab = () => {
    const { colors, styles: S } = useTheme();
    const { needsLogin } = useAuthGate();

    const [settings, setSettings] = useState(null);
    const [saved, setSaved] = useState(null); // last loaded server state, for dirty check
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [notice, setNotice] = useState(null);
    const [teamKey, setTeamKey] = useState(() => {
        try { return localStorage.getItem(TEAM_KEY_STORAGE) || ''; } catch { return ''; }
    });

    const updateTeamKey = (value) => {
        setTeamKey(value);
        try {
            if (value) localStorage.setItem(TEAM_KEY_STORAGE, value);
            else localStorage.removeItem(TEAM_KEY_STORAGE);
        } catch { /* private mode */ }
    };

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const json = await fetchApi('/incidents/settings');
            setSettings(json.data);
            setSaved(json.data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const isDirty = useMemo(() => {
        if (!settings || !saved) return false;
        return SECTION_KEYS.some((k) => JSON.stringify(settings[k]) !== JSON.stringify(saved[k]));
    }, [settings, saved]);

    const flash = (msg) => {
        setNotice(msg);
        setTimeout(() => setNotice(null), 3000);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const payload = {};
            SECTION_KEYS.forEach((k) => { payload[k] = settings[k]; });
            const json = await fetchApi('/incidents/settings', {}, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Settings-Key': teamKey, ...authHeaders() },
                body: JSON.stringify(payload),
            });
            setSettings(json.data);
            setSaved(json.data);
            flash('Saved — applies to the next incident, no restart needed');
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (needsLogin) { setError('איפוס הגדרות דורש התחברות — היכנס בהגדרות.'); return; }
        if (!window.confirm('Reset ALL incident defaults to the built-in values? This removes every customization.')) return;
        setSaving(true);
        setError(null);
        try {
            const json = await fetchApi('/incidents/settings', {}, {
                method: 'DELETE',
                headers: { 'X-Settings-Key': teamKey, ...authHeaders() },
            });
            setSettings(json.data);
            setSaved(json.data);
            flash('Reset to built-in defaults');
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    // ---------- mutation helpers ----------
    const setMapEntry = (section, oldKey, newKey, value) => {
        setSettings((prev) => {
            const next = {};
            entriesOf(prev[section]).forEach(([k, v]) => {
                if (k === oldKey) next[newKey] = value;
                else next[k] = v;
            });
            return { ...prev, [section]: next };
        });
    };

    const removeMapEntry = (section, key) => {
        setSettings((prev) => {
            const next = { ...prev[section] };
            delete next[key];
            return { ...prev, [section]: next };
        });
    };

    const addMapEntry = (section) => {
        const key = window.prompt('ServiceNow field name (e.g. u_my_field):');
        if (!key || !/^[a-zA-Z0-9_]+$/.test(key)) return;
        setSettings((prev) => ({ ...prev, [section]: { ...prev[section], [key]: '' } }));
    };

    // ---------- small styled pieces ----------
    const sectionStyle = { ...S.card(), marginBottom: 16 };
    const sectionTitle = { margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, color: colors.text.primary };
    const sectionHint = { margin: '0 0 12px 0', fontSize: 12, color: colors.text.secondary };
    const monoInput = { ...S.input, fontFamily: 'monospace' };
    const removeBtn = {
        ...S.button.secondary(),
        padding: '6px 8px',
        color: colors.semantic.error,
        borderColor: colors.semantic.error,
    };

    const VariableChips = () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {(settings.template_variables || []).map((v) => (
                <code key={v} style={{
                    background: colors.bg.tertiary,
                    border: `1px solid ${colors.border.secondary}`,
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 12,
                    color: colors.text.primary,
                }}>
                    {`{{${v}}}`}
                </code>
            ))}
        </div>
    );

    // ---------- render ----------
    if (loading) return <div style={S.loading}>Loading incident defaults…</div>;
    if (!settings) return <div style={S.error}>{error || 'Failed to load incident defaults'}</div>;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header / actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 18, color: colors.text.primary }}>Incident Defaults</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: colors.text.secondary }}>
                        Templates and default field values used when building ServiceNow incidents.
                        Saved changes apply to the <strong>next incident immediately</strong> — no restart needed.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} title="Shared team key — required to save changes">
                        <KeyRound size={14} style={{ position: 'absolute', left: 8, color: colors.text.tertiary, pointerEvents: 'none' }} />
                        <input
                            type="password"
                            placeholder="Team key"
                            autoComplete="off"
                            value={teamKey}
                            onChange={(e) => updateTeamKey(e.target.value)}
                            style={{ ...S.input, width: 140, paddingLeft: 28 }}
                        />
                    </div>
                    <button type="button" style={S.button.secondary(saving)} disabled={saving} onClick={load} title="Reload from server">
                        <RefreshCw size={14} /> Reload
                    </button>
                    <button type="button" style={S.button.danger(saving)} disabled={saving} onClick={handleReset}>
                        <RotateCcw size={14} /> Reset to defaults
                    </button>
                    <button type="button" style={S.button.primary(saving || !isDirty)} disabled={saving || !isDirty} onClick={handleSave}>
                        <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>

            {error && <div style={S.error}>{error}</div>}
            {notice && (
                <div style={{
                    background: colors.semantic.successBg, color: colors.semantic.successText,
                    border: `1px solid ${colors.semantic.success}`, padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13,
                }}>
                    {notice}
                </div>
            )}

            {/* Content templates */}
            <div style={sectionStyle}>
                <h3 style={sectionTitle}>Content Templates</h3>
                <p style={sectionHint}>
                    Used when neither the mapping nor a rule provides the field. Available variables:
                </p>
                <VariableChips />
                {entriesOf(settings.content_templates).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                        <input style={{ ...monoInput, width: 220, flex: 'none' }} value={key} readOnly title="ServiceNow field name" />
                        <textarea
                            style={{ ...monoInput, minHeight: 56, resize: 'vertical', direction: 'rtl' }}
                            value={value}
                            onChange={(e) => setMapEntry('content_templates', key, key, e.target.value)}
                        />
                        <button type="button" style={removeBtn} onClick={() => removeMapEntry('content_templates', key)} title="Remove template">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                <button type="button" style={S.button.secondary()} onClick={() => addMapEntry('content_templates')}>
                    <Plus size={14} /> Add template field
                </button>
            </div>

            {/* Default field fillers */}
            <div style={sectionStyle}>
                <h3 style={sectionTitle}>Default Field Values</h3>
                <p style={sectionHint}>
                    Filler values for ServiceNow-mandatory fields, applied only when the incident doesn't already have the field.
                    {' '}{'{{variables}}'} are supported here too.
                </p>
                {entriesOf(settings.default_fields).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <input style={{ ...monoInput, width: 220, flex: 'none' }} value={key} readOnly title="ServiceNow field name" />
                        <input
                            style={monoInput}
                            value={String(value)}
                            onChange={(e) => setMapEntry('default_fields', key, key, e.target.value)}
                        />
                        <button type="button" style={removeBtn} onClick={() => removeMapEntry('default_fields', key)} title="Remove default">
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                <button type="button" style={S.button.secondary()} onClick={() => addMapEntry('default_fields')}>
                    <Plus size={14} /> Add default field
                </button>
            </div>
        </div>
    );
};

export default IncidentDefaultsTab;
