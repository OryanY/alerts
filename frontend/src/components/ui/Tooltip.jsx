import { useState, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { createPortal } from 'react-dom';

const Tooltip = ({ content, children, width = 220, placement = 'top' }) => {
    const { colors } = useTheme();
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const wrapRef = useRef(null);

    if (!content) return <>{children}</>;

    const show = () => {
        if (!wrapRef.current) return;
        const rect = wrapRef.current.getBoundingClientRect();
        setPos({
            x: rect.left + rect.width / 2,
            y: placement === 'bottom' ? rect.bottom + 8 : rect.top - 8,
        });
        setVisible(true);
    };

    return (
        <>
            {/* Real div wrapper — not display:contents — so getBoundingClientRect works */}
            <div
                ref={wrapRef}
                style={{ display: 'inline-flex', position: 'relative' }}
                onMouseEnter={show}
                onMouseLeave={() => setVisible(false)}
            >
                {children}
            </div>

            {visible && createPortal(
                <div style={{
                    position: 'fixed',
                    left: pos.x,
                    top: pos.y,
                    transform: placement === 'bottom'
                        ? 'translateX(-50%)'
                        : 'translateX(-50%) translateY(-100%)',
                    zIndex: 9999,
                    maxWidth: width,
                    padding: '8px 12px',
                    background: colors.bg.elevated || colors.bg.secondary,
                    border: `1px solid ${colors.border.secondary}`,
                    borderRadius: 8,
                    boxShadow: colors.shadow.lg,
                    fontSize: 12,
                    color: colors.text.primary,
                    textAlign: 'center',
                    pointerEvents: 'none',
                    whiteSpace: 'normal',
                    lineHeight: 1.5,
                    animation: 'fadeIn 0.12s ease',
                    marginBottom: placement === 'top' ? 8 : 0,
                    marginTop:    placement === 'bottom' ? 8 : 0,
                }}>
                    {content}
                    {/* Arrow */}
                    <div style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 0, height: 0,
                        border: '5px solid transparent',
                        ...(placement === 'bottom'
                            ? { bottom: '100%', borderBottomColor: colors.border.secondary }
                            : { top: '100%',    borderTopColor:    colors.border.secondary }
                        ),
                    }} />
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
