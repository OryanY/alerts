import React, { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Tooltip = ({ content, children, width = 200, position = 'top' }) => {
    const { colors } = useTheme();
    const [isVisible, setIsVisible] = useState(false);

    const isTop = position === 'top';

    return (
        <div
            style={{ position: 'relative', display: 'inline-flex' }}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div style={{
                    position: 'absolute',
                    ...(isTop ? { bottom: '100%', marginBottom: 8 } : { top: '100%', marginTop: 8 }),
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '8px 12px',
                    background: colors.bg.primary,
                    border: `1px solid ${colors.border.primary}`,
                    borderRadius: 6,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    width: width,
                    fontSize: 12,
                    color: colors.text.primary,
                    textAlign: 'center',
                    pointerEvents: 'none',
                    whiteSpace: 'normal',
                    lineHeight: 1.4
                }}>
                    {content}
                    {/* Arrow */}
                    <div style={{
                        position: 'absolute',
                        ...(isTop
                            ? { top: '100%', borderColor: `${colors.border.primary} transparent transparent transparent` }
                            : { bottom: '100%', borderColor: `transparent transparent ${colors.border.primary} transparent` }
                        ),
                        left: '50%',
                        marginLeft: -5,
                        borderWidth: 5,
                        borderStyle: 'solid'
                    }} />
                    <div style={{
                        position: 'absolute',
                        ...(isTop
                            ? { top: '100%', borderColor: `${colors.bg.primary} transparent transparent transparent`, marginTop: -1 }
                            : { bottom: '100%', borderColor: `transparent transparent ${colors.bg.primary} transparent`, marginBottom: -1 }
                        ),
                        left: '50%',
                        marginLeft: -4,
                        borderWidth: 4,
                        borderStyle: 'solid'
                    }} />
                </div>
            )}
        </div>
    );
};

export default Tooltip;
