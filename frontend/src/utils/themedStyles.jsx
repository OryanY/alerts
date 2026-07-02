const normalizeTheme = (c = {}) => ({

  bg: {
    primary: c?.bg?.primary || '#F9FAFB',
    secondary: c?.bg?.secondary || '#FFFFFF',
    tertiary: c?.bg?.tertiary || '#F3F4F6',
    overlay: c?.bg?.overlay || 'rgba(0,0,0,0.3)',
  },

  text: {
    primary: c?.text?.primary || '#111827',
    secondary: c?.text?.secondary || '#475569',
    tertiary: c?.text?.tertiary || '#64748b',
    inverse: c?.text?.inverse || '#FFFFFF',
    link: c?.text?.link || '#2563EB',
  },

  border: {
    primary: c?.border?.primary || '#E2E8F0',
    secondary: c?.border?.secondary || '#CBD5E1',
    tertiary: c?.border?.tertiary || '#E5E7EB',
    focus: c?.border?.focus || '#3B82F6',
  },

  brand: {
    primary: c?.brand?.primary || '#3B82F6',
    primaryHover: c?.brand?.primaryHover || '#2563EB',

    purple: c?.brand?.purple || '#9333ea',
    purpleLight: c?.brand?.purpleLight || '#e9d5ff',
    purpleDark: c?.brand?.purpleDark || '#6b21a8',

    yellow: c?.brand?.yellow || '#f59e0b',
    yellowLight: c?.brand?.yellowLight || '#fde68a',
    yellowBg: c?.brand?.yellowBg || '#fef3c7',
    yellowDark: c?.brand?.yellowDark || '#92400e',
    yellowBorder: c?.brand?.yellowBorder || '#fcd34d',
  },

  semantic: {
    success: c?.semantic?.success || '#22c55e',
    successBg: c?.semantic?.successBg || '#dcfce7',
    successText: c?.semantic?.successText || '#166534',

    error: c?.semantic?.error || '#dc2626',
    errorBg: c?.semantic?.errorBg || '#fee2e2',
    errorText: c?.semantic?.errorText || '#b91c1c',

    warning: c?.semantic?.warning || '#f59e0b',
    warningBg: c?.semantic?.warningBg || '#fef3c7',
    warningText: c?.semantic?.warningText || '#92400e',

    info: c?.semantic?.info || '#0ea5e9',
    infoBg: c?.semantic?.infoBg || '#e0f2fe',
    infoText: c?.semantic?.infoText || '#0369a1',
  },

  shadow: {
    sm: c?.shadow?.sm || '0 1px 2px rgba(0,0,0,0.05)',
    md: c?.shadow?.md || '0 1px 3px rgba(0,0,0,0.1)',
    xl: c?.shadow?.xl || '0 10px 25px rgba(0,0,0,0.15)',
  },
});

export const createThemedStyles = (raw) => {
  const colors = normalizeTheme(raw);

  return {
    // No minHeight here: every page using this renders inside Layout's own
    // .ops-shell, which already guarantees a full-viewport-minimum height —
    // redeclaring it on a nested page stacks on top of the header/subbar
    // height and adds visible dead scroll space below short content.
    page: {
      background: colors.bg.primary,
      color: colors.text.primary,
    },

    main: { maxWidth: '100%', margin: 0, padding: 16 },

    card: (extra = {}) => ({
      background: colors.bg.secondary,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 6,
      padding: 16,
      boxShadow: 'none',
      ...extra,
    }),

    input: {
      padding: '7px 10px',
      border: `1px solid ${colors.border.secondary}`,
      borderRadius: 6,
      fontSize: 13,
      width: '100%',
      minHeight: 36,
      background: colors.bg.secondary,
      color: colors.text.primary,
    },

    tableHeadCell: {
      padding: 12,
      textAlign: 'left',
      cursor: 'pointer',
      fontWeight: 500,
      borderBottom: `1px solid ${colors.border.primary}`,
      color: colors.text.primary
    },

    tableCell: { padding: 12, color: colors.text.primary },

    grid: (template) => ({
      display: 'grid',
      gridTemplateColumns: template,
      gap: 20,
      marginBottom: 24,
    }),

    skeleton: (w = '100%', h = 20) => ({
      backgroundColor: colors.bg.tertiary,
      height: h,
      width: w,
      borderRadius: 4,
      animation: 'pulse 2s ease-in-out infinite',
    }),

    container: { maxWidth: '100%', margin: 0, padding: 0 },

    title: { margin: '0 0 10px 0', color: colors.text.primary, fontSize: 24 },

    button: {
      primary: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
        background: disabled
          ? colors.brand.primary + '50'
          : colors.brand.primary,
        color: disabled ? colors.text.inverse + '90' : colors.text.inverse,
        border: 'none',
        opacity: disabled ? 0.6 : 1,
      }),

      secondary: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
        background: disabled
          ? colors.bg.tertiary
          : colors.bg.secondary,
        color: disabled
          ? colors.text.tertiary
          : colors.text.primary,
        border: `1px solid ${disabled ? colors.border.secondary : colors.border.primary
          }`,
        opacity: disabled ? 0.6 : 1,
      }),

      danger: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
        background: disabled
          ? colors.semantic.error + '60'
          : colors.semantic.error,
        color: colors.text.inverse,
        border: 'none',
        opacity: disabled ? 0.6 : 1,
      }),

      success: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 500,
        background: disabled
          ? colors.semantic.success + '60'
          : colors.semantic.success,
        color: colors.text.inverse,
        border: 'none',
        opacity: disabled ? 0.6 : 1,
      }),
    },

    error: {
      background: colors.semantic.errorBg,
      color: colors.semantic.errorText,
      padding: 10,
      borderRadius: 4,
      marginBottom: 20,
      border: `1px solid ${colors.semantic.error}`,
    },

    loading: {
      textAlign: 'center',
      padding: 40,
      color: colors.text.secondary,
    },

    badge: (variant = 'default') => {
      const variants = {
        success: { background: colors.semantic.successBg, color: colors.semantic.successText },
        warning: { background: colors.semantic.warningBg, color: colors.semantic.warningText },
        error: { background: colors.semantic.errorBg, color: colors.semantic.errorText },
        info: { background: colors.semantic.infoBg, color: colors.semantic.infoText },
        default: { background: colors.bg.tertiary, color: colors.text.primary },
      };

      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        ...variants[variant],
      };
    },
  };
};
