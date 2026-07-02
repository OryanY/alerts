import { useCallback, useEffect, useState } from 'react';
import { Inbox, Plus, X, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../../utils/constants';
import { useTheme } from '../../contexts/ThemeContext';
import { safeJson, authHeaders } from '../../utils/api';
import { useAuthGate } from '../../hooks/useAuthGate';

// Compact "time since" for the last-seen column (e.g. "3h ago", "2d ago").
const timeAgo = (iso) => {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

// Applications that fired an alert with no matching system mapping. Acts as a
// self-maintaining todo list: click "Map" to open the form pre-filled, or dismiss.
const MappingQueuePanel = ({ refreshSignal, onCreateMapping }) => {
    const { colors } = useTheme();
    const { needsLogin } = useAuthGate();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/incidents/mapping-queue`, { credentials: 'include' });
            const data = await safeJson(res);
            if (data.success) setQueue(data.data || []);
        } catch (e) {
            console.warn('Could not fetch mapping queue:', e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchQueue(); }, [fetchQueue, refreshSignal]);

    const dismiss = async (id) => {
        if (needsLogin) return; // gated: the X is shown disabled with a hint
        // Optimistic: drop it locally, then persist.
        setQueue((prev) => prev.filter((q) => q._id !== id));
        try {
            await fetch(`${API_BASE}/incidents/mapping-queue/${id}`, { method: 'DELETE', headers: authHeaders(), credentials: 'include' });
        } catch (e) {
            console.warn('Could not dismiss queue entry:', e.message);
            fetchQueue();
        }
    };

    // Nothing to show (and not the initial load) → render nothing, no clutter.
    if (!loading && queue.length === 0) return null;

    return (
        <div
            style={{
                background: colors.bg.secondary,
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                border: `1px solid ${colors.border.primary}`,
                borderLeft: `4px solid ${colors.semantic.warning}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <Inbox size={18} style={{ color: colors.semantic.warning }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: colors.text.primary }}>
                    Applications needing a mapping
                </h3>
                {queue.length > 0 && (
                    <span style={{
                        background: colors.semantic.warning,
                        color: colors.text.inverse,
                        borderRadius: 10,
                        padding: '1px 8px',
                        fontSize: 12,
                        fontWeight: 700,
                    }}>
                        {queue.length}
                    </span>
                )}
            </div>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: colors.text.secondary }}>
                These alerted but matched no mapping, so no incident was created. Map them, or dismiss.
            </p>

            {loading && queue.length === 0 ? (
                <div style={{ color: colors.text.tertiary, fontSize: 13, fontStyle: 'italic' }}>Loading…</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {queue.map((item) => (
                        <div
                            key={item._id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: '10px 12px',
                                background: colors.bg.tertiary,
                                borderRadius: 8,
                                border: `1px solid ${colors.border.primary}`,
                            }}
                        >
                            <AlertTriangle size={15} style={{ color: colors.semantic.warning, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: colors.text.primary,
                                    fontFamily: 'monospace',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }} title={item.display_name || item.application}>
                                    {item.display_name || item.application}
                                </div>
                                <div style={{ fontSize: 11, color: colors.text.secondary }}>
                                    {item.hit_count} alert{item.hit_count === 1 ? '' : 's'}
                                    {item.last_seen ? ` · last ${timeAgo(item.last_seen)}` : ''}
                                    {item.last_panel ? ` · ${item.last_panel}` : ''}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onCreateMapping?.(item.application)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: colors.brand.primary,
                                    color: colors.text.inverse,
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '6px 12px',
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                }}
                            >
                                <Plus size={14} />
                                Map
                            </button>
                            <button
                                type="button"
                                onClick={() => dismiss(item._id)}
                                disabled={needsLogin}
                                title={needsLogin ? 'התחברות נדרשת (הגדרות)' : 'Dismiss'}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: colors.text.tertiary,
                                    cursor: needsLogin ? 'not-allowed' : 'pointer',
                                    opacity: needsLogin ? 0.4 : 1,
                                    padding: 4,
                                    display: 'flex',
                                    flexShrink: 0,
                                }}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MappingQueuePanel;
