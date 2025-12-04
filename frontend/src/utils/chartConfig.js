export const createChartConfig = (colors) => ({
  grid: {
    stroke: colors.border.secondary,
    strokeDasharray: '3 3',
  },
  axis: {
    tick: { fill: colors.text.secondary, fontSize: 12 },
    axisLine: { stroke: colors.border.primary },
    tickLine: { stroke: colors.border.primary },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: colors.bg.secondary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 6,
      color: colors.text.primary,
      fontSize: 12,
    },
    labelStyle: { color: colors.text.secondary },
    itemStyle: { fontSize: 12 },
    cursor: { fill: colors.bg.tertiary, opacity: 0.4 },
  },
});

export const getChartProps = (colors) => ({
  grid: {
    stroke: colors.border.secondary,
    strokeDasharray: '3 3',
  },
  xAxis: {
    tick: { fill: colors.text.secondary, fontSize: 12 },
    axisLine: { stroke: colors.border.primary },
    tickLine: { stroke: colors.border.primary },
  },
  yAxis: {
    tick: { fill: colors.text.secondary, fontSize: 12 },
    axisLine: { stroke: colors.border.primary },
    tickLine: { stroke: colors.border.primary },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: colors.bg.secondary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 6,
      color: colors.text.primary,
      fontSize: 12,
    },
    labelStyle: { color: colors.text.secondary },
    itemStyle: { fontSize: 12 },
  },
});

