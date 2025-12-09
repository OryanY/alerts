import { Settings, Plus, RefreshCw, X, Search } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { withAlpha } from '../../utils/helpers';

const IncidentMappingsHeader = ({ showForm, onCreateClick, onRefresh, searchTerm, onSearchChange }) => {
    const { colors } = useTheme();

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
                    <Settings size={28} color={colors.text.primary} />
                    System Mappings
                </h2>

                {/* Only show search when NOT in form mode */}
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
                            placeholder="Search mappings..."
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
                <button
                    onClick={onCreateClick}
                    style={{
                        background: showForm
                            ? `linear-gradient(135deg, ${colors.brand.yellow} 0%, ${colors.semantic.warning} 100%)`
                            : `linear-gradient(135deg, ${colors.brand.primary} 0%, ${colors.brand.primaryHover} 100%)`,
                        color: colors.text.inverse,
                        border: 'none',
                        borderRadius: 12,
                        padding: '12px 24px',
                        fontSize: 16,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: `0 4px 12px ${withAlpha(colors.brand.primary, '40')}`,
                        transition: 'all 0.2s ease',
                    }}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancel' : 'Create New Mapping'}
                </button>

                <button
                    onClick={onRefresh}
                    style={{
                        background: colors.bg.secondary,
                        color: colors.text.secondary,
                        border: `2px solid ${colors.border.primary}`,
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
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>
        </div>
    );
};

export default IncidentMappingsHeader;
