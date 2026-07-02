import { useState, useCallback } from 'react';

// Centralizes the "open a themed confirm dialog, run a callback if the user
// confirms" pattern used across IncidentRules/IncidentMappings/
// IncidentDefaultsTab/SettingsPage, which each used to hand-roll their own
// confirm-dialog state (either a rich {title, body, ...} object or a plain
// boolean + separately-named do-function).
//
// Usage:
//   const { confirm, dialogProps } = useConfirm();
//   confirm({ title, body, confirmLabel, tone, onConfirm: () => doTheThing() });
//   <ConfirmDialog {...dialogProps} />
export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => setState(options), []);
  const close = useCallback(() => setState(null), []);

  const dialogProps = {
    open: !!state,
    title: state?.title,
    body: state?.body,
    confirmLabel: state?.confirmLabel,
    tone: state?.tone,
    onConfirm: () => { close(); state?.onConfirm?.(); },
    onCancel: close,
  };

  return { confirm, dialogProps };
}
