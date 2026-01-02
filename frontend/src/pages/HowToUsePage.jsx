import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

const HowToUsePage = () => {
    const { colors } = useTheme();
    const S = createThemedStyles(colors);
    const [copiedSection, setCopiedSection] = useState(null);

    const baseUrl = window.location.origin;

    const endpoints = {
        incident: `${baseUrl}/api/incidents/incident`,
        alert: `${baseUrl}/api/incidents/alert`,
        both: `${baseUrl}/api/incidents/incident-with-alert`
    };

    const grafanaUrl = `${baseUrl}/api/incidents/alert?application=\${__data.fields['application']}&object_name=\${__data.fields['object']}&node_name=\${__data.fields['node_name']}&message=\${__data.fields['message']}&time_created=\${__data.fields['time_created']}&operator=\${__data.fields['operator']}&network=\${__data.fields['network']}&user=\${__user.login}`;

    const copyToClipboard = (text, section) => {
        navigator.clipboard.writeText(text);
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
    };

    // Custom styles that extend the base theme
    const pageStyles = {
        container: {
            maxWidth: 1000,
            margin: '0 auto',
            padding: '2rem 1rem',
            direction: 'rtl',
            textAlign: 'right'
        },
        section: {
            ...S.card(),
            marginBottom: 24,
            borderRight: `4px solid ${colors.brand.primary}`, // Hebrew right border
            borderLeft: 'none',
        },
        sectionTitle: {
            fontSize: '1.5rem',
            fontWeight: 700,
            color: colors.text.primary,
            marginBottom: 16,
            marginTop: 0,
        },
        codeBlock: {
            background: colors.bg.tertiary,
            padding: 16,
            borderRadius: 8,
            fontFamily: 'monospace',
            direction: 'ltr',
            textAlign: 'left',
            overflowX: 'auto',
            border: `1px solid ${colors.border.primary}`,
            fontSize: '0.9rem',
            color: colors.text.secondary
        },
        card: {
            ...S.card({ padding: 16 }),
            height: '100%',
            transition: 'transform 0.2s',
            ':hover': { transform: 'translateY(-2px)' }
        },
        step: {
            background: colors.bg.tertiary,
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            border: `1px solid ${colors.border.secondary}`
        },
        copyBox: {
            display: 'flex',
            alignItems: 'flex-start',
            background: colors.bg.tertiary,
            border: `1px solid ${colors.border.primary}`,
            borderRadius: 6,
            padding: 8,
            gap: 12,
            marginTop: 4
        },
        copyParams: {
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: colors.brand.purple, // Highlight params
            wordBreak: 'break-all',
            direction: 'ltr',
            textAlign: 'left',
            flex: 1
        },
        fieldGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12,
            marginTop: 12
        },
        fieldItem: (required) => ({
            padding: '8px 12px',
            borderRadius: 6,
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            textAlign: 'center',
            fontWeight: 600,
            background: required ? colors.semantic.errorBg : colors.semantic.infoBg,
            color: required ? colors.semantic.errorText : colors.semantic.infoText,
            border: `1px solid ${required ? colors.semantic.error : colors.semantic.info}`
        })
    };


    return (
        <div style={S.page}>
            <div style={pageStyles.container}>
                <h1 style={{ ...S.title, marginBottom: 8 }}>📖 איך משתמשים ?</h1>
                {/* Available Endpoints */}
                <div style={pageStyles.section}>
                    <h2 style={pageStyles.sectionTitle}>אפשרויות יצירה</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                        <div style={pageStyles.card}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: 0, marginBottom: 8, color: colors.text.primary }}>🎫 רק תקלה</h3>
                            <code style={{ display: 'block', marginBottom: 8, ...pageStyles.codeBlock, padding: 8 }}>{endpoints.incident}</code>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: colors.text.secondary }}>יוצר תקלה ב-ServiceNow עם כל החוקים והמיפויים</p>
                        </div>
                        <div style={pageStyles.card}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: 0, marginBottom: 8, color: colors.text.primary }}>🔔 רק התראה</h3>
                            <code style={{ display: 'block', marginBottom: 8, ...pageStyles.codeBlock, padding: 8 }}>{endpoints.alert}</code>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: colors.text.secondary }}>יוצר התראה ב-ServiceNow</p>
                        </div>
                        <div style={pageStyles.card}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: 0, marginBottom: 8, color: colors.text.primary }}>🎯 גם וגם</h3>
                            <code style={{ display: 'block', marginBottom: 8, ...pageStyles.codeBlock, padding: 8 }}>{endpoints.both}</code>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: colors.text.secondary }}>יוצר גם תקלה וגם התראה, מקושרים ביניהם</p>
                        </div>
                    </div>
                </div>

                {/* Grafana Setup */}
                <div style={{ ...pageStyles.section, borderRightColor: colors.brand.purple }}>
                    <h2 style={pageStyles.sectionTitle}>🔧 איך מגדירים בגרפנה</h2>

                    <div style={pageStyles.step}>
                        <h3 style={{ color: colors.text.primary, margin: '0 0 12px 0' }}>שלב 1: הגדירו את הקישור</h3>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 4, color: colors.text.primary }}>כתובת (URL):</label>
                            <div style={pageStyles.copyBox}>
                                <code style={{ ...pageStyles.copyParams }}>{grafanaUrl}</code>
                                <button
                                    onClick={() => copyToClipboard(grafanaUrl, 'url')}
                                    style={{ ...S.navBtn(false), padding: 8, background: colors.bg.secondary, border: `1px solid ${colors.border.secondary}` }}
                                >
                                    {copiedSection === 'url' ? <Check size={16} color={colors.semantic.success} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={pageStyles.step}>
                        <h3 style={{ color: colors.text.primary, margin: '0 0 12px 0' }}>שלב 2: שדות חובה</h3>
                        <p style={{ color: colors.text.secondary }}>וודאו שהשאילתה שלכם בגרפנה מחזירה את השדות האלה:</p>
                        <div style={pageStyles.fieldGrid}>
                            <div style={pageStyles.fieldItem(true)}>application</div>
                            <div style={pageStyles.fieldItem(true)}>object</div>
                            <div style={pageStyles.fieldItem(true)}>node_name</div>
                            <div style={pageStyles.fieldItem(true)}>message</div>
                            <div style={pageStyles.fieldItem(true)}>operator</div>
                            <div style={pageStyles.fieldItem(false)}>time_created</div>
                            <div style={pageStyles.fieldItem(false)}>network</div>
                        </div>
                        <p style={{ marginTop: 12, fontSize: '0.9rem', fontStyle: 'italic', color: colors.text.tertiary }}>
                            <strong>שימו לב:</strong> השדות המסומנים באדום הם חובה.
                            השדות <code>network</code> ו-<code>time_created</code> הם אופציונליים.
                        </p>
                    </div>
                </div>

                {/* Response */}
                <div style={pageStyles.section}>
                    <h2 style={pageStyles.sectionTitle}>✅ מה אמור לקרות</h2>
                    <p style={{ color: colors.text.secondary, marginBottom: 12 }}>כשהכל עובד, תקבלו תשובה כזאת:</p>
                    <div style={pageStyles.codeBlock}>
                        <pre style={{ margin: 0 }}><code>{`{
  "success": true,
  "message": "Alert created successfully",
  "data": {
    "alertPayload": {
      "short_description": "Alert: Database connection timeout",
      "assignment_group": "...",
      "u_network": "Production"
    },
    "serviceNowResult": {
      "success": true,
      "incident_number": "INC0012345"
    },
    "mapping_used": "507f1f77bcf86cd799439011"
  }
}`}</code></pre>
                    </div>
                </div>

                {/* Troubleshooting */}
                <div style={pageStyles.section}>
                    <h2 style={pageStyles.sectionTitle}>🔍 בעיות נפוצות</h2>
                    <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ ...S.card({ padding: 12 }), borderRight: `4px solid ${colors.semantic.error}` }}>
                            <h4 style={{ margin: '0 0 4px 0', color: colors.semantic.errorText }}>❌ "No system mapping found"</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: colors.text.secondary }}>שם האפליקציה לא תואם לאף מיפוי במערכת. בדקו את המיפויים בעמוד System Mappings.</p>
                        </div>
                        <div style={{ ...S.card({ padding: 12 }), borderRight: `4px solid ${colors.semantic.error}` }}>
                            <h4 style={{ margin: '0 0 4px 0', color: colors.semantic.errorText }}>❌ "Required field missing"</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: colors.text.secondary }}>אחד מהשדות החובה חסר בשאילתה שלכם. וודאו שכל השדות האדומים מופיעים.</p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowToUsePage;
