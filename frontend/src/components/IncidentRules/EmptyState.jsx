import { useTheme } from '../../contexts/ThemeContext';

const EmptyState = () => {
    const { colors } = useTheme();

    return (
        <div
            style={{
                background: colors.bg.secondary,
                border: `3px dashed ${colors.border.secondary}`,
                borderRadius: 16,
                padding: 48,
                textAlign: 'center',
            }}
        >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
            <h3
                style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: colors.brand.purple,
                    marginBottom: 12,
                }}
            >
                No Rules Yet
            </h3>
            <p
                style={{
                    fontSize: 16,
                    color: colors.text.secondary,
                    marginBottom: 24,
                    maxWidth: 480,
                    margin: '0 auto',
                }}
            >
                Create rules to handle specific alert types with custom conditions.
            </p>
        </div>
    );
};

export default EmptyState;
