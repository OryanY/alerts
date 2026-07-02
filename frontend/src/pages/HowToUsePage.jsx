import React, { useState, useMemo } from 'react';
import {
    Copy, Check, Terminal, PlayCircle, Server,
    Settings, Link as LinkIcon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';
import { API_BASE } from '../utils/constants';

const alertRequiredFields = ['application', 'object_name', 'node_name', 'message', 'operator'];
const commonOptionalFields = ['time_created', 'network', 'user'];

const HowToUsePage = () => {
    const { colors } = useTheme();
    const S = useMemo(() => createThemedStyles(colors), [colors]);

    const [copiedSection, setCopiedSection] = useState(null);
    const [activeTab, setActiveTab] = useState('grafana');

    const baseUrl = API_BASE;

    const endpoints = [
        {
            id: 'incident',
            url: `${baseUrl}/incidents/incident`,
            title: 'יצירת תקלה בלבד',
            icon: Server,
            desc: 'פותח תקלה (Incident) ב-ServiceNow עם שיוך אוטומטי לצוות הרלוונטי.',
            color: colors.brand.primary,
            req: alertRequiredFields,
            opt: commonOptionalFields
        },
        {
            id: 'alert',
            url: `${baseUrl}/incidents/alert`,
            title: 'יצירת התראה בלבד',
            icon: Terminal,
            desc: 'יוצר התראת ServiceNow לצרכי ניטור וקישור לתקלה ללא פתיחת תקלה חדשה.',
            color: colors.brand.purple,
            req: alertRequiredFields,
            opt: [...commonOptionalFields, 'incident_number', 'incident_sys_id']
        },
        {
            id: 'both',
            url: `${baseUrl}/incidents/incident-with-alert`,
            title: 'תקלה + התראה',
            icon: PlayCircle,
            desc: 'פותח התראה ומקשר אותה לתקלה חדשה (או קיימת) באופן אוטומטי.',
            color: colors.semantic.success,
            req: alertRequiredFields,
            opt: [...commonOptionalFields]
        }
    ];

    // -------------------------------------------------------------------------
    //  Two example URLs (escaped placeholders) – used only for display / copy
    // -------------------------------------------------------------------------
    const alertExample = `
    ${baseUrl}/incidents/alert?
    application=\${__data.fields['application']}&
    object_name=\${__data.fields['object']}&
    node_name=\${__data.fields['node_name']}&
    message=\${__data.fields['message']}&
    time_created=\${__data.fields['time_created']}&
    operator=\${__data.fields['operator']}&
    network=\${__data.fields['network']}&
    user=\${__user.login}
    `.trim();

    /* -------------------------------------------------------------
    Example for the **incident** endpoint
    ------------------------------------------------------------- */
    const incidentExample = `
    ${baseUrl}/incidents/incident?
    application=\${__data.fields['application']}&
    object_name=\${__data.fields['object']}&
    node_name=\${__data.fields['node_name']}&
    message=\${__data.fields['message']}&
    time_created=\${__data.fields['time_created']}&
    operator=\${__data.fields['operator']}&
    network=\${__data.fields['network']}&
    user=\${__user.login}
    `.trim();

    const copyToClipboard = (text, section) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    const tabs = [
        { id: 'grafana', label: 'חיבור לגרפנה', icon: Settings },
        { id: 'endpoints', label: 'בקשות HTTP', icon: LinkIcon },
    ];

    const pageStyles = useMemo(() => ({
        container: {
            maxWidth: 1000,
            margin: '0 auto',
            padding: '3rem 1rem',
            direction: 'rtl',
            textAlign: 'right'
        },
        tabContainer: {
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            marginBottom: '3rem',
            background: colors.bg.tertiary,
            padding: 8,
            borderRadius: 16,
            border: `1px solid ${colors.border.primary}`,
            width: 'fit-content',
            margin: '0 auto 3rem auto'
        },
        tab: (isActive) => ({
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 24px',
            borderRadius: 12,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '1rem',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            background: isActive ? colors.bg.primary : 'transparent',
            color: isActive ? colors.brand.primary : colors.text.secondary,
            border: `1px solid ${isActive ? colors.border.secondary : 'transparent'}`,
            boxShadow: isActive ? colors.shadow.md : 'none',
            transform: isActive ? 'scale(1.05)' : 'scale(1)'
        }),
        card: {
            ...S.card({ padding: '2.5rem' }),
            animation: 'slideUp 0.4s ease-out'
        },
        codeBox: {
            position: 'relative',
            background: '#0f172a',
            borderRadius: 12,
            padding: '1.5rem',
            marginTop: '1.5rem',
            direction: 'ltr',
            textAlign: 'left',
            border: '1px solid #1e293b'
        },
        codeText: {
            fontFamily: "'Fira Code', monospace",
            fontSize: '0.9rem',
            color: '#cbd5e1',
            wordBreak: 'break-all',
            lineHeight: 1.6
        },
        badge: (required) => ({
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: 8,
            fontSize: '0.75rem',
            fontWeight: 800,
            background: required ? `${colors.semantic.error}15` : `${colors.semantic.info}15`,
            color: required ? colors.semantic.errorText : colors.semantic.infoText,
            border: `1px solid ${required ? colors.semantic.error : colors.semantic.info}30`
        })
    }), [colors, S]);

    // -------------------------------------------------------------------------
    //  Render the Grafana tab – NEW INSTRUCTION BLOCK + TWO EXAMPLE URLs
    // -------------------------------------------------------------------------
    const renderGrafanaTab = () => (
    <div style={pageStyles.card}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '2rem' }}>
        <div style={{ padding: 12, background: `${colors.brand.primary}15`, borderRadius: 12 }}>
            <Settings size={28} color={colors.brand.primary} />
        </div>
        <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: colors.text.primary }}>
            הגדרת פתיחה בגרפנה
            </h2>
        </div>
        </div>

        {/* --------------------------------------------------------------
            Instruction text – bold parts are now <strong>
            -------------------------------------------------------------- */}
        <div style={{
        color: colors.text.secondary,
        marginBottom: '2rem',
        fontSize: '1.1rem',
        lineHeight: 1.7
        }}>
        כדי לפתוח תקלות מהגרפאנה יש להוסיף לשליפה <code>alert</code>,{' '}
       <code>incident</code>.<br />
        ואז ניתן להוסיף לינק לכל אחד מהכפתורים האלו באמצעות <strong>Data Links</strong>.<br />
        <div>
            ניתן גם ליצור <strong>התראה</strong> בעזרת ה‑URL של <code>alert</code>:
        </div>
        </div>

        {/* Alert example ---------------------------------------------------- */}
        <div style={pageStyles.codeBox}>
        <button
            onClick={() => copyToClipboard(alertExample, 'alert')}
            style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: '#334155',
            border: 'none',
            borderRadius: 8,
            padding: 8,
            color: '#fff',
            cursor: 'pointer'
            }}
        >
            {copiedSection === 'alert' ? <Check size={18} color="#4ade80" /> : <Copy size={18} />}
        </button>
        <pre style={pageStyles.codeText}>{alertExample}</pre>
        </div>

        {/* Spacer ----------------------------------------------------------- */}
        <div style={{ height: 24 }} />

        {/* Incident intro – now with <strong> */}
        <div style={{
        color: colors.text.secondary,
        marginBottom: '2rem',
        fontSize: '1.1rem',
        lineHeight: 1.7
        }}>
        <div>או, ליצירת <strong>תקלה בלבד</strong>:</div>
        </div>

        {/* Incident example ------------------------------------------------- */}
        <div style={pageStyles.codeBox}>
        <button
            onClick={() => copyToClipboard(incidentExample, 'incident')}
            style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: '#334155',
            border: 'none',
            borderRadius: 8,
            padding: 8,
            color: '#fff',
            cursor: 'pointer'
            }}
        >
            {copiedSection === 'incident' ? <Check size={18} color="#4ade80" /> : <Copy size={18} />}
        </button>
        <pre style={pageStyles.codeText}>{incidentExample}</pre>
        </div>
    </div>
    );

    // -------------------------------------------------------------------------
    //  Render the HTTP‑endpoints tab (unchanged)
    // -------------------------------------------------------------------------
    const renderEndpointsTab = () => (
        <div style={pageStyles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '2.5rem' }}>
                <div style={{ padding: 12, background: `${colors.brand.purple}15`, borderRadius: 12 }}>
                    <LinkIcon size={28} color={colors.brand.purple} />
                </div>
                <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: colors.text.primary }}>
                    בקשות HTTP
                </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {endpoints.map((ep) => {
                    const Icon = ep.icon;
                    return (
                        <div key={ep.id} style={{
                            background: colors.bg.tertiary,
                            border: `1px solid ${colors.border.primary}`,
                            borderRadius: 16,
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 16
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Icon color={ep.color} size={22} />
                                    <h3 style={{ margin: 0, color: colors.text.primary, fontSize: '1.2rem', fontWeight: 700 }}>
                                        {ep.title}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => copyToClipboard(ep.url, ep.id)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.text.tertiary }}
                                >
                                    {copiedSection === ep.id ? <Check size={18} color={colors.semantic.success} /> : <Copy size={18} />}
                                </button>
                            </div>
                            <p style={{ color: colors.text.secondary, fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                                {ep.desc}
                            </p>
                            <div style={{ marginTop: 'auto' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: colors.text.primary, marginBottom: 8 }}>
                                    שדות חובה:
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                                    {ep.req.map(f => <span key={f} style={pageStyles.badge(true)}>{f}</span>)}
                                </div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: colors.text.primary, marginBottom: 8 }}>
                                    אופציונלי:
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {ep.opt.map(f => <span key={f} style={pageStyles.badge(false)}>{f}</span>)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    // -------------------------------------------------------------------------
    //  Main render
    // -------------------------------------------------------------------------
    return (
        <div style={S.page}>
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            <div style={pageStyles.container}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h1 style={{ ...S.title, fontSize: '3rem', marginBottom: 12 }}>
                        📖 איך משתמשים במערכת?
                    </h1>
                    <p style={{ color: colors.text.secondary, fontSize: '1.2rem' }}>
                        המדריך המלא לחיבור ושימוש ב-API של מערכת פתיחת התקלות
                    </p>
                </div>

                <div style={pageStyles.tabContainer}>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <div
                                key={tab.id}
                                style={pageStyles.tab(activeTab === tab.id)}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon size={20} />
                                {tab.label}
                            </div>
                        );
                    })}
                </div>

                <div style={{ minHeight: 400 }}>
                    {activeTab === 'grafana' && renderGrafanaTab()}
                    {activeTab === 'endpoints' && renderEndpointsTab()}
                </div>
            </div>
        </div>
    );
};

export default HowToUsePage;