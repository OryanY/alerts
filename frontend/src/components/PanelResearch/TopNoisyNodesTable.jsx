import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ChartCard } from '../ui/ChartCard';
import { formatDuration } from '../../utils/formatters';

const TopNoisyNodesTable = ({ nodes, loading, selectedNode, onSelectNode }) => {
    const { colors } = useTheme();
    const S = useMemo(() => createThemedStyles(colors), [colors]);

    return (
        <div style={{ marginTop: 20 }}>
            <ChartCard
                title="Top Noisy Nodes"
                loading={loading}
                height="auto"
            >
                <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: colors.bg.tertiary, borderBottom: `2px solid ${colors.border.primary}` }}>
                                <th scope="col" style={S.tableHeadCell}>Node Name (Click to Filter)</th>
                                <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'center' }}>Alert Count</th>
                                <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'center' }}>Avg Duration</th>
                                <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'right' }}>Last Alert</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(nodes || []).map((node, i) => {
                                const isSelected = selectedNode === node.node_name;
                                const select = () => onSelectNode(isSelected ? null : node.node_name);
                                return (
                                    <tr
                                        key={i}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isSelected}
                                        style={{
                                            borderBottom: `1px solid ${colors.border.primary}`,
                                            background: isSelected ? colors.semantic.infoBg : 'transparent',
                                            cursor: 'pointer'
                                        }}
                                        onClick={select}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } }}
                                    >
                                        <td style={{ ...S.tableCell, fontWeight: 500, color: isSelected ? colors.semantic.infoText : colors.text.primary }}>
                                            {node.node_name}
                                        </td>
                                        <td style={{ ...S.tableCell, textAlign: 'center', fontWeight: 'bold', color: colors.chart.primary }}>{node.alert_count}</td>
                                        <td style={{ ...S.tableCell, textAlign: 'center', color: colors.text.secondary }}>{formatDuration(node.avg_duration)}</td>
                                        <td style={{ ...S.tableCell, textAlign: 'right', color: colors.text.secondary }}>
                                            {new Date(node.last_alert).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </ChartCard>
        </div>
    );
};

export default React.memo(TopNoisyNodesTable);
