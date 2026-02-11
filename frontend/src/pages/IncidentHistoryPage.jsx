
import React, { useState, useEffect } from 'react';
import { useApiData } from '../hooks/useApiData';
import { useTheme } from '../contexts/ThemeContext';
import {
    Search, CheckCircle,
    AlertTriangle, ChevronRight, Activity, Globe, Zap
} from 'lucide-react';


const IncidentHistoryPage = () => {
    const { colors } = useTheme();

    const [search, setSearch] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    // Use useApiData hook which handles credentials, loading, and error states
    const { data: logsData, loading, error } = useApiData(
        '/incidents/incident-logs',
        { search }, // Params
        { skip: false } // Options
    );

    // useApiData already extracts json.data if present, so logsData is likely the array itself
    const logs = Array.isArray(logsData) ? logsData : (logsData?.data || []);

    // Effect to refetch when search changes is handled by useApiData automatically
    // But we need to handle manual refresh if needed
    useEffect(() => {
        if (error) {
            console.error('Failed to fetch logs', error);
        }
    }, [error]);

    // Helper to format date
    const formatDate = (isoString) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleString('en-IL', {
            dateStyle: 'short',
            timeStyle: 'medium'
        });
    };

    return (
        <div style={{ padding: 24, paddingBottom: 100 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: colors.text.primary, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Activity size={24} color={colors.brand.primary} /> Incident History
                </h1>
                <p style={{ margin: 0, color: colors.text.secondary }}>
                    Audit trail of all automated incidents and the rules that triggered them.
                </p>
            </div>

            {/* Toolbar */}
            <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
                <div style={{
                    display: 'flex', alignItems: 'center',
                    background: colors.bg.secondary,
                    border: `1px solid ${colors.border.primary}`,
                    borderRadius: 8, padding: '8px 12px', flex: 1, maxWidth: 400
                }}>
                    <Search size={16} color={colors.text.tertiary} style={{ marginRight: 8 }} />
                    <input
                        placeholder="Search application, incident number..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ background: 'none', border: 'none', color: colors.text.primary, width: '100%', outline: 'none' }}
                    />
                </div>
            </div>

            {/* Main Content: Table + Detail Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedLog ? '1fr 400px' : '1fr', gap: 24, transition: 'all 0.3s ease' }}>

                {/* Table */}
                <div style={{
                    background: colors.bg.secondary,
                    borderRadius: 12,
                    border: `1px solid ${colors.border.primary}`,
                    overflow: 'hidden'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: colors.bg.tertiary, borderBottom: `1px solid ${colors.border.primary}` }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: colors.text.tertiary }}>TIME</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: colors.text.tertiary }}>APPLICATION</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: colors.text.tertiary }}>INCIDENT #</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: colors.text.tertiary }}>RULES APPLIED</th>
                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 12, color: colors.text.tertiary }}>STATUS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr
                                    key={log._id}
                                    onClick={() => setSelectedLog(log)}
                                    style={{
                                        cursor: 'pointer',
                                        background: selectedLog?._id === log._id ? `${colors.brand.primary}10` : 'transparent',
                                        borderBottom: `1px solid ${colors.border.secondary}`
                                    }}
                                >
                                    <td style={{ padding: '12px 16px', fontSize: 13, color: colors.text.secondary }}>
                                        {formatDate(log.created_at)}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                        {log.application}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace' }}>
                                        {log.servicenow_result?.link ? (
                                            <a
                                                href={log.servicenow_result.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(e) => e.stopPropagation()} // Prevent row click
                                                style={{ color: colors.brand.primary, textDecoration: 'none', fontWeight: 600 }}
                                            >
                                                {log.servicenow_result.incident_number}
                                            </a>
                                        ) : (
                                            log.servicenow_result?.incident_number || '-'
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {log.process_info?.applied_rules?.length > 0 ? (
                                                log.process_info.applied_rules.map((rule, idx) => (
                                                    <span key={idx} style={{
                                                        fontSize: 11, padding: '2px 6px', borderRadius: 4,
                                                        background: colors.bg.tertiary, border: `1px solid ${colors.border.output}`
                                                    }}>
                                                        {rule}
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ fontSize: 11, color: colors.text.tertiary }}>Base Mapping Only</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {log.servicenow_result?.success || log.servicenow_result?.incident_number ? (
                                            <span style={{ color: colors.semantic.success, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                                <CheckCircle size={14} /> Created
                                            </span>
                                        ) : (
                                            <span style={{ color: colors.semantic.error, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                                                <AlertTriangle size={14} /> Failed
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: colors.text.tertiary }}>
                                        No logs found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Info Panel */}
                {selectedLog && (
                    <div style={{
                        background: colors.bg.secondary,
                        borderRadius: 12,
                        border: `1px solid ${colors.border.primary}`,
                        display: 'flex', flexDirection: 'column',
                        height: 'fit-content',
                        position: 'sticky', top: 24
                    }}>
                        <div style={{ padding: 16, borderBottom: `1px solid ${colors.border.secondary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: 16 }}>Incident Details</h3>
                            <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text.secondary }}>✕</button>
                        </div>

                        <div style={{ padding: 16, overflowY: 'auto', maxHeight: '80vh' }}>

                            {/* Summary Card */}
                            <div style={{ padding: 12, background: colors.bg.tertiary, borderRadius: 8, marginBottom: 16 }}>
                                <div style={{ fontSize: 12, color: colors.text.tertiary }}>INCIDENT NUMBER</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: colors.brand.primary }}>
                                    {selectedLog.servicenow_result?.link ? (
                                        <a
                                            href={selectedLog.servicenow_result.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: colors.brand.primary, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                                        >
                                            {selectedLog.servicenow_result.incident_number}
                                            <ChevronRight size={16} />
                                        </a>
                                    ) : (
                                        selectedLog.servicenow_result?.incident_number || 'N/A'
                                    )}
                                </div>
                                <div style={{ fontSize: 12, marginTop: 4, color: colors.text.secondary }}>
                                    Source: {selectedLog.alert_source?.node_name || 'Unknown Node'}
                                </div>
                            </div>

                            {/* Rules Timeline */}
                            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: colors.text.tertiary, marginBottom: 12 }}>Processing Logic</h4>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 24 }}>
                                {/* 1. Mapping */}
                                <div style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                                    <div style={{ width: 1, background: colors.border.primary, position: 'absolute', left: 10, top: 16, bottom: 0 }}></div>
                                    <div style={{ zIndex: 1, background: colors.bg.secondary, padding: 2 }}>
                                        <Globe size={16} color={colors.text.tertiary} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>System Mapping Found</div>
                                        <div style={{ fontSize: 12, color: colors.text.secondary }}>
                                            Used base mapping for <b>{selectedLog.process_info?.mapping_name || 'App'}</b>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Rules */}
                                {(selectedLog.process_info?.rule_stack_snapshot || []).map((rule, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                                        <div style={{ width: 1, background: colors.border.primary, position: 'absolute', left: 10, top: 16, bottom: 0 }}></div>
                                        <div style={{ zIndex: 1, background: colors.bg.secondary, padding: 2 }}>
                                            {/* Specific icon color based on assumption/data. You could add is_global to snapshot if available */}
                                            <Zap size={16} color={colors.brand.secondary} fill={colors.brand.secondary} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>Applied Rule: {rule.name}</div>
                                            <div style={{ fontSize: 11, color: colors.text.secondary, marginTop: 2 }}>
                                                Overrides: {Object.keys(rule.overrides || {}).join(', ')}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* 3. Creation */}
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ zIndex: 1, background: colors.bg.secondary, padding: 2 }}>
                                        <CheckCircle size={16} color={colors.semantic.success} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>Incident Created</div>
                                        <div style={{ fontSize: 12, color: colors.text.secondary }}>
                                            Successfully sent to ServiceNow
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Raw Data */}
                            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: colors.text.tertiary, marginBottom: 8 }}>Final Payload</h4>
                            <pre style={{
                                background: colors.bg.primary,
                                padding: 12, borderRadius: 8,
                                fontSize: 11, overflowX: 'auto',
                                border: `1px solid ${colors.border.primary}`
                            }}>
                                {JSON.stringify(selectedLog.incident_payload, null, 2)}
                            </pre>

                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncidentHistoryPage;
