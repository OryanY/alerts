import React from 'react';
import { withAlpha } from '../../utils/formatters';

const TemplateHints = ({ colors }) => (
    <div
        style={{
            background: withAlpha(colors.brand.primary, '10'),
            border: `1px solid ${withAlpha(colors.brand.primary, '30')}`,
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            fontSize: 13,
            color: colors.text.secondary,
        }}
    >
        <strong style={{ color: colors.brand.primary, display: 'block', marginBottom: 4 }}>
            💡 Template Variables Available
        </strong>
        You can use dynamic variables in{' '}
        <span style={{ fontWeight: 600 }}>Network</span>,{' '}
        <span style={{ fontWeight: 600 }}>Impact Tech</span>, and{' '}
        <span style={{ fontWeight: 600 }}>Custom Fields</span>:
        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
                '{{ application }}',
                '{{ object_name }}',
                '{{ node_name }}',
                '{{ message }}',
                '{{ operator }}',
                '{{ network }}',
                '{{ time_created }}',
            ].map((tag) => (
                <code
                    key={tag}
                    style={{
                        background: colors.bg.primary,
                        border: `1px solid ${colors.border.secondary}`,
                        borderRadius: 4,
                        padding: '2px 6px',
                        fontFamily: 'monospace',
                        color: colors.text.primary,
                    }}
                >
                    {tag}
                </code>
            ))}
        </div>
    </div>
);

export default TemplateHints;
