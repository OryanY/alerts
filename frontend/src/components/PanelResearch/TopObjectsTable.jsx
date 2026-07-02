import React, { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { ChartCard } from '../ui/ChartCard';
import { formatDuration } from '../../utils/formatters';

const TopObjectsTable = ({ objects, loading, selectedObject, onSelectObject }) => {
    const { colors } = useTheme();
    const S = useMemo(() => createThemedStyles(colors), [colors]);

    return (
        <div style={{ marginTop: 20 }}>
            <ChartCard
                title="Top Noisy Objects"
                loading={loading}
                height="auto"
            >
                <div style={{ overflowX: 'auto', maxHeight: 300 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: colors.bg.tertiary, borderBottom: `2px solid ${colors.border.primary}` }}>
                                <th scope="col" style={S.tableHeadCell}>Object (Click to Filter)</th>
                                <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'center' }}>Alert Count</th>
                                <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'center' }}>Avg Duration</th>
                                <th scope="col" style={{ ...S.tableHeadCell, textAlign: 'right' }}>Last Alert</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(objects || []).map((obj, i) => {
                                const isSelected = selectedObject === obj.object;
                                const select = () => onSelectObject && onSelectObject(isSelected ? null : obj.object);
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
                                            {obj.object}
                                        </td>
                                        <td style={{ ...S.tableCell, textAlign: 'center', fontWeight: 'bold', color: colors.chart.primary }}>{obj.alert_count}</td>
                                        <td style={{ ...S.tableCell, textAlign: 'center', color: colors.text.secondary }}>{formatDuration(obj.avg_duration)}</td>
                                        <td style={{ ...S.tableCell, textAlign: 'right', color: colors.text.secondary }}>
                                            {new Date(obj.last_alert).toLocaleString()}
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

export default React.memo(TopObjectsTable);
