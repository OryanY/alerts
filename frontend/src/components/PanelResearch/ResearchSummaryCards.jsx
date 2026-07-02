import React, { useMemo } from 'react';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { useClientConfig } from '../../contexts/ClientConfigContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import Tooltip from '../ui/Tooltip';
import { Sparkline, RadialGauge, CompareBars } from '../ui/kpiViz';
import { formatDuration } from '../../utils/formatters';

const ResearchSummaryCards = ({ summary, dailyTrend = [] }) => {
    const { colors } = useTheme();
    const S = createThemedStyles(colors);
    const { config } = useClientConfig();

    const thresholdMin = Math.round((config.falseWakeupThreshold || 120) / 60);
    // Volume-per-day series for the sparklines (hook must run before any return).
    const alertSeries = useMemo(() => (dailyTrend || []).map((d) => d.alert_count || 0), [dailyTrend]);

    if (!summary) return null;

    const nightTrue = Math.max(0, (summary.night_wakeups || 0) - (summary.night_false_wakeups || 0));
    const trendColor = summary.trend_direction === 'increasing'
        ? colors.semantic.error
        : summary.trend_direction === 'decreasing'
            ? colors.semantic.success
            : colors.text.secondary;

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 20,
                direction: 'rtl',
            }}
        >
            {/* Total Alerts */}
            <div style={S.card()}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                    }}
                >
                    <AlertTriangle
                        size={20}
                        style={{ color: colors.semantic.warning }}
                    />
                    <Tooltip content="סה״כ התראות (או אירועים מאוחדים) בתקופה שנבחרה." position="bottom">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            סה״כ התראות
                        </span>
                    </Tooltip>
                </div>
                <div
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: colors.text.primary,
                    }}
                >
                    {summary.total_alerts}
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: colors.text.secondary,
                        marginTop: 4,
                    }}
                >
                    {summary.alerts_per_day} ליום
                </div>
                <div style={{ marginTop: 10 }}>
                    <Sparkline data={alertSeries} color={colors.chart.primary} />
                </div>
            </div>

            {/* Avg/Median Duration */}
            <div style={S.card()}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                    }}
                >
                    <Clock
                        size={20}
                        style={{ color: colors.chart.primary }}
                    />
                    <Tooltip content="משך זמן ממוצע וחציון (טיפוסי)" position="bottom">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            משך זמן (ממוצע | חציון)
                        </span>
                    </Tooltip>
                </div>
                <div
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: colors.text.primary,
                    }}
                >
                    {formatDuration(summary.avg_duration)} | {formatDuration(summary.median_duration)}
                </div>
                <div style={{ marginTop: 10 }}>
                    <CompareBars items={[
                        { label: 'ממוצע', value: summary.avg_duration || 0, color: colors.chart.primary },
                        { label: 'חציון', value: summary.median_duration || 0, color: colors.chart.secondary },
                    ]} />
                </div>
            </div>

            {/* False Positive Rate */}
            <div style={S.card()}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                    }}
                >
                    <AlertTriangle
                        size={20}
                        style={{ color: colors.semantic.error }}
                    />
                    <Tooltip content={`אחוז ההתראות שנחשבות כשווא (משך קצר מ-${thresholdMin} דקות).`} position="bottom">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            אחוז התראות שווא
                        </span>
                    </Tooltip>
                </div>
                <div
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: colors.text.primary,
                    }}
                >
                    {summary.false_positive_rate}%
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: colors.text.secondary,
                        marginTop: 4,
                    }}
                >
                    משך  &gt; {thresholdMin}  דקות
                </div>
                <div style={{ marginTop: 10 }}>
                    <RadialGauge value={summary.false_positive_rate || 0} color={colors.semantic.error} />
                </div>
            </div>

            {/* Night Wakeups */}
            <div style={S.card()}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                    }}
                >
                    <Clock
                        size={20}
                        style={{ color: colors.brand.secondary }}
                    />
                    <Tooltip content="מספר התראות לילה שחצו את סף התראות השווא." position="bottom">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            התראות לילה
                        </span>
                    </Tooltip>
                </div>
                <div
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: colors.text.primary,
                    }}
                >
                    {summary.night_wakeups}
                </div>
                <div
                    style={{
                        fontSize: 12,
                        color: colors.text.secondary,
                        marginTop: 4,
                    }}
                >
                    {summary.night_false_wakeups} התראות שווא
                </div>
                <div style={{ marginTop: 10 }}>
                    <CompareBars items={[
                        { label: 'אמת', value: nightTrue, color: colors.brand.secondary },
                        { label: 'שווא', value: summary.night_false_wakeups || 0, color: colors.semantic.error },
                    ]} />
                </div>
            </div>

            {/* Trend */}
            <div style={S.card()}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                    }}
                >
                    <TrendingUp
                        size={20}
                        style={{
                            color:
                                summary.trend_direction === 'increasing'
                                    ? colors.semantic.error
                                    : summary.trend_direction ===
                                        'decreasing'
                                        ? colors.semantic.success
                                        : colors.text.secondary,
                        }}
                    />
                    <Tooltip content="מגמת נפח ההתראות בהשוואה לחצי הראשון של התקופה שנבחרה." position="bottom">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            מגמה
                        </span>
                    </Tooltip>
                </div>
                <div
                    style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color:
                            summary.trend_direction === 'increasing'
                                ? colors.semantic.error
                                : summary.trend_direction ===
                                    'decreasing'
                                    ? colors.semantic.success
                                    : colors.text.secondary,
                        textTransform: 'capitalize',
                    }}
                >
                    {summary.trend_direction === 'increasing' ? 'מגמת עליה' : summary.trend_direction === 'decreasing' ? 'מגמת ירידה' : 'יציב'}
                </div>
                <div style={{ marginTop: 10 }}>
                    <Sparkline data={alertSeries} color={trendColor} />
                </div>
            </div>
        </div>
    );
};

export default ResearchSummaryCards;
