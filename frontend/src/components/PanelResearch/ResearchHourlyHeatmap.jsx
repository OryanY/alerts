import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import { Clock } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ChartCard } from '../ui/ChartCard';
import { getChartProps } from '../../utils/chartConfig';

const ResearchHourlyHeatmap = ({ hourly_heatmap, loading }) => {
    const { colors } = useTheme();
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
                <BarChart data={hourly_heatmap || []}>
                    <CartesianGrid {...chartProps.grid} />
                    <XAxis
                        dataKey="hour"
                        {...chartProps.xAxis}
                        tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                    />
                    <YAxis {...chartProps.yAxis} />
                    <Tooltip
                        {...chartProps.tooltip}
                        labelFormatter={(h) =>
                            `${String(h).padStart(2, '0')}:00`
                        }
                        formatter={(value, name) => [
                            value,
                            name === 'count' ? 'Alerts' : 'Avg Duration',
                        ]}
                    />
                    <Bar dataKey="count">
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
                </BarChart>
            </ResponsiveContainer>
        </ChartCard>
    );
};

export default ResearchHourlyHeatmap;
