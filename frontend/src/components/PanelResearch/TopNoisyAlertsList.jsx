import React from 'react';
import { Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ChartCard } from '../ui/ChartCard';
import { formatDuration } from '../../utils/formatters';

import { useClientConfig } from '../../contexts/ClientConfigContext';

const TopNoisyAlertsList = ({ alerts, loading }) => {
    const { colors } = useTheme();
    const { config } = useClientConfig();
    // eslint-disable-next-line
    const S = createThemedStyles(colors);

    return (
        <ChartCard
            title="Top Noisy Alerts"
            icon={Zap}
            loading={loading}
        >
            <div
                style={{
                    maxHeight: 300,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }}
            >
                {(alerts || [])
                    .slice(0, 10)
                    .map((alert, idx) => {
                        const isTop = idx < 3;
                        return (
                            <div
                                key={idx}
                                style={{
                                    padding: 10,
                                    borderRadius: 6,

                                    background: isTop
                                        ? colors.semantic.errorBg
                                        : colors.bg.tertiary,
                                    borderWidth: 1,
                                    borderStyle: 'solid',
                                    borderColor: isTop
                                        ? colors.semantic.error
                                        : colors.border.primary,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        marginBottom: 4,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        color: colors.text.primary,
                                    }}
                                    title={alert.message}
                                >
                                    {alert.message || 'N/A'}
                                </div>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: 11,
                                        color: colors.text.secondary,
                                    }}
                                >
                                    <span>{alert.count} times</span>
                                    <span>{formatDuration(alert.avg_duration)} avg | {formatDuration(alert.median_duration)} med </span>
                                </div>
                                <div
                                    style={{
                                        fontSize: 10,
                                        color: colors.semantic.error,
                                        marginTop: 2,
                                    }}
                                >
                                    {alert.false_positive_rate}% false positive
                                </div>
                            </div>
                        );
                    })}
            </div>
        </ChartCard>
    );
};

export default TopNoisyAlertsList;
