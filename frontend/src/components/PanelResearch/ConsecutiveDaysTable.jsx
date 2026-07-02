import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ChartCard } from '../ui/ChartCard';

const ConsecutiveDaysTable = ({ nodes, loading, onSelectNode, selectedNode }) => {
    const { colors } = useTheme();
    const S = useMemo(() => createThemedStyles(colors), [colors]);

    return (
        <ChartCard
            title="התראות חזרתיות (3+ ימים)"
            loading={loading}
            height="auto"
            subtitle="Click a row to filter dashboard by node"
        >
            <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: colors.bg.tertiary, borderBottom: `2px solid ${colors.border.primary}` }}>
                            <th scope="col" style={S.tableHeadCell}>Node Name</th>
                            <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'center' }}>Consecutive Days</th>
                            <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'center' }}>Total Alerts</th>
                            <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'right' }}>Date Range</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(nodes || []).map((node, i) => {
                            const isSelected = selectedNode === node.node_name;
                            const select = () => onSelectNode && onSelectNode(isSelected ? null : node.node_name);
                            return (
                                <tr
                                    key={i}
                                    role="button"
                                    tabIndex={0}
                                    aria-pressed={isSelected}
                                    onClick={select}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } }}
                                    style={{
                                        borderBottom: `1px solid ${colors.border.primary}`,
                                        cursor: 'pointer',
                                        background: isSelected ? colors.bg.tertiary : 'transparent',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = colors.bg.tertiary)}
                                    onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={{ ...S.tableCell, fontWeight: 500, color: isSelected ? colors.brand.primary : colors.text.primary }}>
                                        {node.node_name}
                                    </td>
                                    <td style={{ ...S.tableCell, textAlign: 'center', fontWeight: 'bold', color: colors.semantic.error }}>{node.consecutive_days}</td>
                                    <td style={{ ...S.tableCell, textAlign: 'center' }}>{node.total_alerts}</td>
                                    <td style={{ ...S.tableCell, textAlign: 'right', color: colors.text.secondary }}>
                                        {new Date(node.first_alert_date).toLocaleDateString()} - {new Date(node.last_alert_date).toLocaleDateString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </ChartCard>
    );
};

export default React.memo(ConsecutiveDaysTable);
