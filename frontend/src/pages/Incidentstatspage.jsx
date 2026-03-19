// frontend/src/pages/IncidentStatsPage.jsx
import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Area, ComposedChart, Line
} from 'recharts';
import { FileText, AlertTriangle, Users, Zap, TrendingUp, Layers } from 'lucide-react';
import { useApiData } from '../hooks/useApiData';
import { useClientConfig } from '../contexts/ClientConfigContext';
import { DateRangePicker } from '../components/ui/DateRangePicker';
import { ChartCard } from '../components/ui/ChartCard';
import { MetricCard } from '../components/ui/MetricCard';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';
import { getChartProps } from '../utils/chartConfig';

const CoverageBar = ({ value, colors }) => {
    const color = value > 66
        ? colors.semantic.success
        : value > 33
            ? colors.semantic.warning
            : colors.semantic.error;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 36, color: colors.text.primary }}>{value}%</span>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: colors.bg.tertiary, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(value, 100)}%`, background: color }} />
            </div>
        </div>
    );
};

const StatTable = ({ rows, nameKey, colors }) => (
    <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
                <tr style={{ background: colors.bg.tertiary, borderBottom: `2px solid ${colors.border.primary}` }}>
                    {[
                        { h: 'שם', t: 'שם הישות (צוות/אפליקציה)' },
                        { h: 'סה"כ', t: 'סה"כ התראות' },
                        { h: 'תקלות', t: 'תקלות שנפתחו באופן ייחודי' },
                        { h: '+ התראות', t: 'התראות נוספות שקובצו תחת אותן תקלות' },
                        { h: 'ללא', t: 'התראות שלא שויכו לתקלה' },
                        { h: 'ממוצע', t: 'ממוצע התראות לכל תקלה שנפתחה' },
                        { h: 'כיסוי', t: 'אחוז כיסוי - כמה מההתראות קושרו לתקלה' }
                    ].map((col, i) => (
                        <th key={col.h} title={col.t} style={{
                            padding: '8px 6px', textAlign: i === 0 ? 'right' : 'center',
                            fontWeight: 600, color: colors.text.secondary, whiteSpace: 'nowrap'
                        }}>{col.h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {rows.map((row, i) => {
                    const name = row[nameKey] || '—';
                    const extraAlerts = Math.max(0, (row.alerts_covered || 0) - (row.unique_incidents || 0));

                    return (
                        <tr key={i} style={{
                            borderBottom: `1px solid ${colors.border.primary}`,
                            background: i < 3 ? `${colors.brand.primary}08` : 'transparent'
                        }}>
                            <td style={{
                                padding: '8px 10px', fontWeight: 500, color: colors.text.primary,
                                maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                textAlign: 'right'
                            }} title={name}>
                                {i < 3 && (
                                    <span style={{
                                        marginLeft: 5, fontSize: 10, background: colors.brand.primary,
                                        color: '#fff', padding: '1px 4px', borderRadius: 3, fontWeight: 700
                                    }}>#{i + 1}</span>
                                )}
                                {name}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: colors.text.primary }}>
                                {(row.total_alerts || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span style={{
                                    fontWeight: 700,
                                    color: (row.unique_incidents || 0) > 0 ? colors.semantic.info : colors.text.tertiary
                                }}>
                                    {(row.unique_incidents || 0).toLocaleString()}
                                </span>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: colors.text.secondary }}>
                                {extraAlerts.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: colors.text.secondary }}>
                                {(row.no_incident || 0).toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: colors.text.secondary }}>
                                {row.avg_alerts_per_incident ?? '—'}
                            </td>
                            <td style={{ padding: '8px 10px', minWidth: 120 }}>
                                <CoverageBar value={row.coverage_pct ?? 0} colors={colors} />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);



const IncidentStatsPage = () => {
    const { dateRange, setDateRange, setPresetRange } = useClientConfig();
    const { colors } = useTheme();
    const S = createThemedStyles(colors);
    const chartProps = getChartProps(colors);

    const { data, loading } = useApiData('/stats/incident-stats');

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        return (
            <div style={{
                background: colors.bg.secondary,
                border: `1px solid ${colors.border.secondary}`,
                borderRadius: 8, padding: '12px 16px', fontSize: 13,
                color: colors.text.primary,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                direction: 'rtl', minWidth: 220,
                zIndex: 1000
            }}>
                <div style={{ fontWeight: 700, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${colors.border.tertiary}`, color: colors.brand.primary }}>
                    {d?.fullName || label}
                </div>
                <div style={{ color: colors.text.primary, marginBottom: 10, fontWeight: 800, fontSize: 14 }}>
                    סה"כ התראות: {(d?.total || 0).toLocaleString()}
                </div>
                {payload.map((p, i) => (
                    <div key={i} style={{ color: p.color, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{p.name}:</span>
                        <strong style={{ marginLeft: 8 }}>{(p.value || 0).toLocaleString()}</strong>
                    </div>
                ))}
                {d?.avg_alerts_per_incident && (
                    <div style={{ marginTop: 10, color: colors.text.secondary, borderTop: `1px solid ${colors.border.tertiary}`, paddingTop: 8, fontSize: 11 }}>
                        ממוצע {d.avg_alerts_per_incident} התראות לתקלה
                    </div>
                )}
            </div>
        );
    };

    const coverage = useMemo(() => data?.coverage || {}, [data?.coverage]);
    const byTeam = useMemo(() => data?.by_team || [], [data?.by_team]);
    const byApp = useMemo(() => data?.by_application || [], [data?.by_application]);
    const daily = useMemo(() => data?.daily_trend || [], [data?.daily_trend]);

    const teamChartData = useMemo(() =>
        byTeam.slice(0, 12).map(r => ({
            name: (r.panel_title || '—').slice(0, 18),
            fullName: r.panel_title || '—',
            total: r.total_alerts || 0,
            tickets: r.unique_incidents || 0,
            coveredExtra: Math.max(0, (r.alerts_covered || 0) - (r.unique_incidents || 0)),
            noIncident: r.no_incident || 0,
            avg_alerts_per_incident: r.avg_alerts_per_incident,
        })), [byTeam]);

    const appChartData = useMemo(() =>
        byApp.slice(0, 12).map(r => ({
            name: (r.application || '—').slice(0, 18),
            fullName: r.application || '—',
            total: r.total_alerts || 0,
            tickets: r.unique_incidents || 0,
            coveredExtra: Math.max(0, (r.alerts_covered || 0) - (r.unique_incidents || 0)),
            noIncident: r.no_incident || 0,
            avg_alerts_per_incident: r.avg_alerts_per_incident,
        })), [byApp]);

    const noIncidentPct = coverage.total_alerts > 0
        ? parseFloat((((coverage.alerts_no_incident || 0) * 100) / coverage.total_alerts).toFixed(1))
        : 0;

    return (
        <div dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <DateRangePicker dateRange={dateRange} onChange={setDateRange} setPresetRange={setPresetRange} />
            </div>
            {/* KPIs */}
            <div style={{ ...S.grid('repeat(auto-fit, minmax(160px, 1fr))'), marginBottom: 24 }}>
                <MetricCard
                    title='סה"כ התראות'
                    value={(coverage.total_alerts ?? 0).toLocaleString()}
                    icon={AlertTriangle} logoColor="orange" loading={loading}
                    tooltip="סך כל ההתראות שהתקבלו בתקופת הזמן שנבחרה."
                />
                <MetricCard
                    title="תקלות שנפתחו"
                    value={(coverage.unique_incidents ?? 0).toLocaleString()}
                    icon={FileText} logoColor="blue" loading={loading}
                    tooltip="מספר התקלות הייחודיות שנפתחו בפועל ב-ServiceNow."
                />
                <MetricCard
                    title="קושרו לתקלה"
                    value={(coverage.alerts_covered ?? 0).toLocaleString()}
                    subtitle={`${coverage.coverage_pct ?? 0}% מההתראות`}
                    icon={TrendingUp} logoColor="green" loading={loading}
                    tooltip="מספר ההתראות שקובצו בהצלחה לתוך תקלות."
                />
                <MetricCard
                    title="התראות ללא תקלה"
                    value={(coverage.alerts_no_incident ?? 0).toLocaleString()}
                    subtitle={`${noIncidentPct}% מההתראות`}
                    icon={Zap} logoColor="red" loading={loading}
                    tooltip="התראות שלא נפתחה עבורן תקלה (בגלל חוק ה-15 דקות, חוסר מיפוי, או שנסגרו מהר מדי)."
                />
                <MetricCard
                    title="ממוצע התראות לתקלה"
                    value={coverage.avg_alerts_per_incident ?? '—'}
                    icon={Layers} logoColor="purple" loading={loading}
                    tooltip="מדד צפיפות - כמה התראות בממוצע קובצו לתוך כל תקלה שנפתחה."
                />
                <MetricCard
                    title="צוותים עם אירועים"
                    value={coverage.teams_with_incidents != null
                        ? `${coverage.teams_with_incidents} / ${coverage.total_teams}`
                        : '—'}
                    icon={Users} logoColor="orange" loading={loading}
                    tooltip="מספר הצוותים (לפי פאנל) שנפתחה להם לפחות תקלה אחת."
                />
            </div>

            {/* Stacked bar charts */}
            <div style={S.grid('repeat(auto-fit, minmax(450px, 1fr))')} dir="ltr">
                <ChartCard title="פילוח תקלות לפי צוות (12 המובילים)" loading={loading} height={340}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={teamChartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                            <CartesianGrid {...chartProps.grid} horizontal={false} />
                            <XAxis type="number" {...chartProps.xAxis} />
                            <YAxis type="category" dataKey="name" width={130}
                                tick={{ fill: colors.text.secondary, fontSize: 11 }}
                                tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="tickets" name="תקלות (Incidents)" stackId="a"
                                fill={colors.brand.primary} />
                            <Bar dataKey="coveredExtra" name="התראות נוספות באותה תקלה" stackId="a"
                                fill={`${colors.brand.primary}44`} />
                            <Bar dataKey="noIncident" name="ללא תקלה" stackId="a"
                                fill={colors.border.secondary} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="פילוח תקלות לפי אפליקציה (12 המובילים)" loading={loading} height={340}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={appChartData} layout="vertical" margin={{ left: 8, right: 24 }}>
                            <CartesianGrid {...chartProps.grid} horizontal={false} />
                            <XAxis type="number" {...chartProps.xAxis} />
                            <YAxis type="category" dataKey="name" width={130}
                                tick={{ fill: colors.text.secondary, fontSize: 11 }}
                                tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="tickets" name="תקלות (Incidents)" stackId="a"
                                fill={colors.brand.purple} />
                            <Bar dataKey="coveredExtra" name="התראות נוספות באותה תקלה" stackId="a"
                                fill={`${colors.brand.purple}44`} />
                            <Bar dataKey="noIncident" name="ללא תקלה" stackId="a"
                                fill={colors.border.secondary} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Daily trend */}
            <div dir="ltr" style={{ marginTop: 20 }}>
                <ChartCard title="מגמת אירועים יומית - התראות לעומת תקלות" loading={loading} height={260}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={daily}>
                            <CartesianGrid {...chartProps.grid} />
                            <XAxis dataKey="date_il" {...chartProps.xAxis}
                                tickFormatter={d => {
                                    try { return new Date(d).toLocaleDateString('he-IL', { month: 'short', day: 'numeric' }); }
                                    catch { return d; }
                                }} />
                            <YAxis {...chartProps.yAxis} />
                            <Tooltip {...chartProps.tooltip}
                                labelFormatter={d => {
                                    try { return new Date(d).toLocaleDateString('he-IL', { weekday: 'short', month: 'short', day: 'numeric' }); }
                                    catch { return d; }
                                }} />
                            <Area type="monotone" dataKey="total_alerts" name='סה"כ התראות'
                                fill={colors.chart.primary} fillOpacity={0.12}
                                stroke={colors.chart.primary} strokeWidth={1.5} />
                            <Area type="monotone" dataKey="alerts_covered" name="קושרו לתקלה"
                                fill={colors.semantic.success} fillOpacity={0.15}
                                stroke={colors.semantic.success} strokeWidth={1.5} />
                            <Line type="monotone" dataKey="unique_incidents" name="תקלות שנפתחו"
                                stroke={colors.semantic.error} strokeWidth={2.5}
                                dot={{ r: 3, fill: colors.semantic.error }} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Detail tables */}
            <div style={{ ...S.grid('repeat(auto-fit, minmax(450px, 1fr))'), marginTop: 20 }}>
                <div style={S.card()}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: colors.text.primary }}>
                        פילוח מלא לפי צוות
                    </h3>
                    {loading
                        ? <div style={{ color: colors.text.tertiary, padding: 20, textAlign: 'center' }}>טוען נתונים...</div>
                        : <StatTable rows={byTeam} nameKey="panel_title" colors={colors} />
                    }
                </div>
                <div style={S.card()}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600, color: colors.text.primary }}>
                        פילוח מלא לפי אפליקציה
                    </h3>
                    {loading
                        ? <div style={{ color: colors.text.tertiary, padding: 20, textAlign: 'center' }}>טוען נתונים...</div>
                        : <StatTable rows={byApp} nameKey="application" colors={colors} />
                    }
                </div>
            </div>
        </div>
    );
};

export default IncidentStatsPage;