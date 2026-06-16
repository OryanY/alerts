import { Target, Plus, X, RefreshCw, Search, LayoutList } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const IncidentRulesHeader = ({
    showForm,
    onToggleForm,
    onRefresh,
    loading,
    searchTerm,
    onSearchChange,
    viewMode,
    onToggleViewMode
}) => {
    const { colors, gradients } = useTheme();

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 32,
                padding: '0 8px',
            }}
        >
            <div>
                <h2
                    style={{
                        margin: '0 0 16px 0',
                        fontSize: 28,
                        fontWeight: 700,
                        color: colors.text.primary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <Target size={28} color={colors.text.primary} />
                    Incident Rules
                </h2>

                {!showForm && (
                    <div style={{ position: 'relative', width: 300 }}>
                        <Search
                            size={18}
                            style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: colors.text.tertiary
                            }}
                        />
                        <input
                            type="text"
                            placeholder="Search rules..."
                            value={searchTerm}
                            onChange={(e) => onSearchChange(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 38px',
                                borderRadius: 8,
                                border: `1px solid ${colors.border.secondary}`,
                                background: colors.bg.secondary,
                                color: colors.text.primary,
                                fontSize: 14,
                                outline: 'none'
                            }}
                        />
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
                {!showForm && (
                    <button
                        onClick={onToggleViewMode}
                        style={{
                            background: colors.bg.secondary,
                            color: colors.text.secondary,
                            border: `2px solid ${colors.border.secondary}`,
                            borderRadius: 12,
                            padding: '12px 20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 14,
                            fontWeight: 500,
                            transition: 'all 0.2s ease',
                        }}
                        title={viewMode === 'compact' ? "Switch to Expanded View" : "Switch to Compact View"}
                    >
                        <LayoutList size={16} />
                        {viewMode === 'compact' ? 'Compact' : 'Expanded'}
                    </button>
                )}
                <button
                    onClick={onToggleForm}
                    style={{
                            background: showForm
                                ? gradients.warningGradient
                                : gradients.infoGradient,
                            color: colors.text.primary,
                            border: 'none',
                            borderRadius: 12,
                            padding: '12px 24px',
                            fontSize: 16,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        {showForm ? <X size={18} /> : <Plus size={18} />}
                        {showForm ? 'Cancel' : 'Create Rule'}
                    </button>

                <button
                    onClick={onRefresh}
                    disabled={loading}
                    style={{
                        background: colors.bg.secondary,
                        color: colors.text.secondary,
                        border: `2px solid ${colors.border.secondary}`,
                        borderRadius: 12,
                        padding: '12px 20px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        opacity: loading ? 0.7 : 1,
                    }}
                >
                    <RefreshCw
                        size={16}
                        style={loading ? { animation: 'spin 1s linear infinite' } : {}}
                    />
                    Refresh
                </button>
            </div>
        </div>
    );
};

export default IncidentRulesHeader;
