import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Themed replacement for window.confirm() on destructive/high-impact actions.
// Confirm button gets initial focus; Escape cancels; clicking the backdrop
// cancels. tone='danger' (default) is red for delete/reset, 'warning' is amber
// for lower-stakes-but-still-consequential actions (e.g. disabling a rule).
const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}) => {
  const { colors } = useTheme();
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const toneColor = tone === 'warning' ? colors.semantic.warning : colors.semantic.error;
  const toneText = tone === 'warning' ? colors.semantic.warningText : colors.semantic.errorText;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.bg.secondary,
          border: `1px solid ${colors.border.primary}`,
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ color: toneColor, flexShrink: 0, marginTop: 2 }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 id="confirm-dialog-title" style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 700, color: colors.text.primary }}>
              {title}
            </h3>
            <p id="confirm-dialog-body" style={{ margin: 0, fontSize: 13, color: colors.text.secondary, lineHeight: 1.5 }}>
              {body}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${colors.border.primary}`,
              background: colors.bg.secondary,
              color: colors.text.secondary,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: toneColor,
              color: toneText,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
