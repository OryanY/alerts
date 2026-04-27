import React from 'react';
import {
    ComposedChart,
    BarChart,
    Area,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import { Activity, Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ChartCard } from '../ui/ChartCard';
import { getChartProps } from '../../utils/chartConfig';

const ResearchTrendCharts = ({ daily_trend, duration_distribution, loading }) => {
    const { colors } = useTheme();
    const S = createThemedStyles(colors);
    const chartProps = getChartProps(colors);

    return (
        <div style={S.grid('1fr 1fr')}>
            {/* Alert Frequency Trend */}
            <ChartCard
                title="Alert Frequency Trend"
                icon={Activity}
                loading={loading}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={daily_trend || []}>
                        <CartesianGrid {...chartProps.grid} />
                        <XAxis
                            dataKey="date_il"
                            {...chartProps.xAxis}
                            tickFormatter={(date) =>
                                new Date(date).toLocaleDateString('en-IL', {
                                    month: 'short',
                                    day: 'numeric',
                                })
                            }
                        />
                        <YAxis {...chartProps.yAxis} />
                        <Tooltip
                            {...chartProps.tooltip}
                            labelFormatter={(date) =>
                                new Date(date).toLocaleDateString('en-IL')
                            }
                        />
                        <Area
                            type="monotone"
                            dataKey="alert_count"
                            fill={colors.chart.primary}
                            fillOpacity={0.25}
                            stroke={colors.chart.primary}
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="alert_count"
                            stroke={colors.chart.secondary}
                            strokeWidth={2}
                            dot={{ r: 4, fill: colors.chart.primary }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </ChartCard>

            {/* Duration Distribution */}
            <ChartCard
                title="Duration Distribution"
                icon={Clock}
                loading={loading}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={duration_distribution || []}>
                        <CartesianGrid {...chartProps.grid} />
                        <XAxis dataKey="category" {...chartProps.xAxis} />
                        <YAxis {...chartProps.yAxis} />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    const entry = payload[0];
                                    const index = payload[0].payload.category === 'Short' ? 0 : payload[0].payload.category === 'Medium' ? 1 : 2;
                                    let barColor = colors.semantic.error;
                                    if (index === 1) barColor = colors.semantic.warning;
                                    if (index >= 2) barColor = colors.semantic.success;
                                    
                                    return (
                                        <div style={{...chartProps.tooltip.contentStyle}}>
                                            <p style={{ margin: 0, color: colors.text.secondary, marginBottom: 4 }}>{label}</p>
                                            <p style={{ margin: 0, color: barColor, fontWeight: 'bold' }}>
                                                Count: {entry.value}
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            {(duration_distribution || []).map(
                                (entry, index) => {
                                    let fillColor = colors.semantic.error;
                                    if (index === 1) fillColor = colors.semantic.warning;
                                    if (index >= 2) fillColor = colors.semantic.success;
                                    return (
                                        <Cell key={`cell-${index}`} fill={fillColor} />
                                    );
                                }
                            )}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>
        </div>
    );
};

export default ResearchTrendCharts;
