import React from 'react';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import { Clock } from 'lucide-react';
import { useClientConfig } from '../../contexts/ClientConfigContext';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ChartCard } from '../ui/ChartCard';
import { getChartProps } from '../../utils/chartConfig';
import { formatDuration } from '../../utils/formatters';

const ResearchHourlyHeatmap = ({ hourly_heatmap, loading }) => {
    const { colors } = useTheme();
    const { config } = useClientConfig();
    const durationMetric = config?.durationMetric || 'average';
    // eslint-disable-next-line
    const S = createThemedStyles(colors);
    const chartProps = getChartProps(colors);

    return (
        <ChartCard
            title="Hourly Alert Pattern"
            icon={Clock}
            loading={loading}
        >
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourly_heatmap || []}>
                    <CartesianGrid {...chartProps.grid} />
                    <XAxis
                        dataKey="hour"
                        {...chartProps.xAxis}
                        tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                    />
                    <YAxis yAxisId="left" {...chartProps.yAxis} />
                    <YAxis yAxisId="right" orientation="right" {...chartProps.yAxis} />
                    <Tooltip
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const h = String(label).padStart(2, '0') + ':00';
                                return (
                                    <div style={{...chartProps.tooltip.contentStyle}}>
                                        <p style={{ margin: 0, color: colors.text.secondary, marginBottom: 4 }}>{h}</p>
                                        {payload.map((entry, index) => {
                                            const isCount = entry.dataKey === 'count';
                                            const barColor = entry.payload?.is_night ? colors.brand.purple : colors.chart.primary;
                                            const color = isCount ? barColor : entry.color;
                                            const value = isCount ? entry.value : formatDuration(entry.value);
                                            const name = isCount ? 'Alerts' : (durationMetric === 'average' ? 'Average Duration' : 'Median Duration');
                                            return (
                                                <p key={index} style={{ margin: 0, color: color, fontWeight: 'bold' }}>
                                                    {name}: {value}
                                                </p>
                                            );
                                        })}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar yAxisId="left" dataKey="count">
                        {(hourly_heatmap || []).map(
                            (entry, idx) => (
                                <Cell
                                    key={idx}
                                    fill={
                                        entry.is_night
                                            ? colors.brand.purple
                                            : colors.chart.primary
                                    }
                                />
                            )
                        )}
                    </Bar>
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey={durationMetric === 'average' ? 'avg_duration' : 'median_duration'}
                        stroke={colors.chart.quaternary}
                        strokeWidth={2}
                        name={durationMetric === 'average' ? 'Average Duration' : 'Median Duration'}
                        dot={{ r: 4, fill: colors.chart.quaternary }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default ResearchHourlyHeatmap;
