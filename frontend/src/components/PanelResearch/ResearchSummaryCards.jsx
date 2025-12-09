import React from 'react';
import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';

const ResearchSummaryCards = ({ summary }) => {
    const { colors } = useTheme();
    const S = createThemedStyles(colors);

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
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: colors.text.secondary,
                        }}
                    >
                        Total Alerts
                    </span>
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

            {/* Avg Duration */}
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
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: colors.text.secondary,
                        }}
                    >
                        Avg Duration
                    </span>
                </div>
                <div
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: colors.text.primary,
                    }}
                >
                    {summary.avg_duration}s
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
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: colors.text.secondary,
                        }}
                    >
                        False Positive Rate
                    </span>
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
                    &lt; {120}s threshold
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
                    <Clock // Assuming Moon was replaced or reused, using Clock as generally safe or check original
                        size={20}
                        style={{ color: colors.brand.secondary }}
                    />
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: colors.text.secondary,
                        }}
                    >
                        Night Wakeups
                    </span>
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
                    <span
                        style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: colors.text.secondary,
                        }}
                    >
                        Trend
                    </span>
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
