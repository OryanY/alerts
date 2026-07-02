import React, { useMemo } from 'react';
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
import { ChartCard } from '../ui/ChartCard';
import { getChartProps } from '../../utils/chartConfig';
import { formatDuration } from '../../utils/formatters';

const ResearchHourlyHeatmap = ({ hourly_heatmap, loading }) => {
    const { colors } = useTheme();
    const { config } = useClientConfig();
    const chartProps = useMemo(() => getChartProps(colors), [colors]);

    const dayNightLegend = (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 11, color: colors.text.secondary }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors.chart.primary }} />
                יום ({config.dayStart ?? 8}:00–{config.dayEnd ?? 22}:00)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colors.brand.purple }} />
                לילה ({config.nightStart ?? 22}:00–{config.nightEnd ?? 8}:00)
            </span>
        </div>
    );

    return (
        <ChartCard
            title="תבנית התראות שעתית"
            icon={Clock}
            loading={loading}
            legend={dayNightLegend}
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
                                            const name = isCount ? 'התראות' : (entry.dataKey === 'avg_duration' ? 'משך ממוצע' : 'משך חציוני');
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
                        dataKey="avg_duration"
                        stroke={colors.chart.quaternary}
                        strokeWidth={2}
                        name="משך ממוצע"
                        dot={{ r: 4, fill: colors.chart.quaternary }}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="median_duration"
                        stroke={colors.chart.secondary}
                        strokeWidth={2}
                        name="משך חציוני"
                        dot={{ r: 4, fill: colors.chart.secondary }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default React.memo(ResearchHourlyHeatmap);
