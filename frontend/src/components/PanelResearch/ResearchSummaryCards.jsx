import React from 'react';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { useClientConfig } from '../../contexts/ClientConfigContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import Tooltip from '../ui/Tooltip';
import { formatDuration } from '../../utils/formatters';

const ResearchSummaryCards = ({ summary }) => {
    const { colors } = useTheme();
    const S = createThemedStyles(colors);
    const { config } = useClientConfig();
    const durationMetric = config.durationMetric || 'average';

    const thresholdMin = Math.round((config.falseWakeupThreshold || 120) / 60);

    if (!summary) return null;

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 20,
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
                    <Tooltip content="סה״כ התראות (או אירועים מאוחדים) בתקופה שנבחרה.">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            Total Alerts
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
                    {summary.alerts_per_day} per day
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
                    <Tooltip content={
                        durationMetric === 'median'
                            ? "משך זמן טיפוסי"
                            : "משך ממוצע"
                    }>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            {durationMetric === 'median' ? 'Median Duration' : 'Avg Duration'}
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
                    {formatDuration(durationMetric === 'median' ? summary.median_duration : summary.avg_duration)}
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
                    <Tooltip content={`אחוז ההתראות שנחשבות כשווא (משך קצר מ-${thresholdMin} דקות).`}>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            False Positive Rate
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
                    &lt; {thresholdMin}m threshold
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
                    <Tooltip content="מספר התראות לילה שחצו את סף התראות השווא.">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            Night Wakeups
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
                    {summary.night_false_wakeups} false wakeups
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
                    <Tooltip content="מגמת נפח ההתראות בהשוואה לחצי הראשון של התקופה שנבחרה.">
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.text.secondary,
                                cursor: 'help',
                                borderBottom: `1px dotted ${colors.text.tertiary}`
                            }}
                        >
                            Trend
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
                    {summary.trend_direction}
                </div>
            </div>
        </div>
    );
};

export default ResearchSummaryCards;
