import React, { useMemo } from 'react';
import {
    PieChart,
    Pie,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { ChartCard } from '../ui/ChartCard';
import { getChartProps } from '../../utils/chartConfig';

const TopApplicationsChart = ({ data, loading }) => {
    const { colors } = useTheme();
    const chartProps = useMemo(() => getChartProps(colors), [colors]);

    const chartData = useMemo(() => (data || [])
        .filter(d => d.application && d.application !== 'N/A' && d.application !== 'Unknown')
        .slice(0, 10), [data]);

    return (
        <ChartCard
            title="Top Applications (Top 10)"
            loading={loading}
        >
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        dataKey="alert_count"
                        nameKey="application"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        isAnimationActive={false}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={[
                                colors.chart.primary,
                                colors.chart.secondary,
                                colors.chart.tertiary,
                                colors.chart.quaternary,
                                colors.chart.quinary,
                                colors.brand.purpleDark,
                                colors.semantic.infoText,
                                colors.semantic.successText,
                                colors.semantic.warningText,
                                colors.semantic.errorText
                            ][index % 10]} />
                        ))}
                    </Pie>
                    <Tooltip {...chartProps.tooltip} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default React.memo(TopApplicationsChart);
