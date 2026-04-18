const normalizeTheme = (c = {}) => ({
  bg: {
    primary:   c?.bg?.primary   || '#080C14',
    secondary: c?.bg?.secondary || '#0D1520',
    tertiary:  c?.bg?.tertiary  || '#111A27',
    card:      c?.bg?.card      || '#0F1B28',
    glass:     c?.bg?.glass     || 'rgba(13,21,32,0.85)',
    elevated:  c?.bg?.elevated  || '#0F1B28',
    overlay:   c?.bg?.overlay   || 'rgba(0,0,0,0.75)',
  },
  text: {
    primary:   c?.text?.primary   || '#E2E8F0',
    secondary: c?.text?.secondary || '#64748B',
    tertiary:  c?.text?.tertiary  || '#3D5068',
    inverse:   c?.text?.inverse   || '#080C14',
    link:      c?.text?.link      || '#00D4FF',
  },
  border: {
    primary:   c?.border?.primary   || 'rgba(0,212,255,0.10)',
    secondary: c?.border?.secondary || 'rgba(0,212,255,0.20)',
    tertiary:  c?.border?.tertiary  || 'rgba(0,212,255,0.06)',
    focus:     c?.border?.focus     || 'rgba(0,212,255,0.60)',
  },
  brand: {
    primary:      c?.brand?.primary      || '#00D4FF',
    primaryHover: c?.brand?.primaryHover || '#00BFEA',
    cyan:         c?.brand?.cyan         || '#00D4FF',
    purple:       c?.brand?.purple       || '#8B5CF6',
    purpleLight:  c?.brand?.purpleLight  || 'rgba(139,92,246,0.15)',
    purpleDark:   c?.brand?.purpleDark   || '#6D28D9',
    yellow:       c?.brand?.yellow       || '#F59E0B',
    yellowBorder: c?.brand?.yellowBorder || '#D97706',
  },
  semantic: {
    success:     c?.semantic?.success     || '#10B981',
    successBg:   c?.semantic?.successBg   || 'rgba(16,185,129,0.12)',
    successText: c?.semantic?.successText || '#A7F3D0',
    error:       c?.semantic?.error       || '#EF4444',
    errorBg:     c?.semantic?.errorBg     || 'rgba(239,68,68,0.12)',
    errorText:   c?.semantic?.errorText   || '#FECACA',
    warning:     c?.semantic?.warning     || '#F59E0B',
    warningBg:   c?.semantic?.warningBg   || 'rgba(245,158,11,0.12)',
    warningText: c?.semantic?.warningText || '#FDE68A',
    info:        c?.semantic?.info        || '#00D4FF',
    infoBg:      c?.semantic?.infoBg      || 'rgba(0,212,255,0.10)',
    infoText:    c?.semantic?.infoText    || '#A5F3FC',
  },
  shadow: {
    sm: c?.shadow?.sm || '0 1px 3px rgba(0,0,0,0.4)',
    md: c?.shadow?.md || '0 4px 16px rgba(0,0,0,0.5)',
    lg: c?.shadow?.lg || '0 10px 40px rgba(0,0,0,0.6)',
    xl: c?.shadow?.xl || '0 20px 60px rgba(0,0,0,0.7)',
  },
  glow: {
    cyan:   c?.glow?.cyan   || '0 0 20px rgba(0,212,255,0.25)',
    purple: c?.glow?.purple || '0 0 20px rgba(139,92,246,0.25)',
    green:  c?.glow?.green  || '0 0 20px rgba(16,185,129,0.25)',
    red:    c?.glow?.red    || '0 0 20px rgba(239,68,68,0.25)',
  },
  chart: {
    primary:   c?.chart?.primary   || '#00D4FF',
    secondary: c?.chart?.secondary || '#8B5CF6',
    tertiary:  c?.chart?.tertiary  || '#10B981',
    quaternary:c?.chart?.quaternary|| '#F59E0B',
    quinary:   c?.chart?.quinary   || '#EF4444',
  },
});

export const createThemedStyles = (raw) => {
  const colors = normalizeTheme(raw);

  return {
    // ── Layout ──────────────────────────────────────────
    page: {
      minHeight: '100vh',
      background: colors.bg.primary,
      color: colors.text.primary,
    },

    // ── Legacy header (kept for compatibility) ──────────
    header: {
      background: colors.bg.secondary,
      borderBottom: `1px solid ${colors.border.primary}`,
      boxShadow: colors.shadow.sm,
    },
    headerInner: { maxWidth: 1600, margin: '0 auto', padding: '0 24px' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 },

    // ── Navigation ──────────────────────────────────────
    navBtn: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 12px',
      border: active ? `1px solid ${colors.border.primary}` : '1px solid transparent',
      borderLeft: active ? `3px solid ${colors.brand.cyan}` : '3px solid transparent',
      borderRadius: 8,
      background: active
        ? `linear-gradient(135deg, ${colors.semantic.infoBg}, transparent)`
        : 'transparent',
      color: active ? colors.brand.cyan : colors.text.secondary,
      fontSize: 13,
      fontWeight: 500,
      cursor: 'pointer',
      width: '100%',
      textAlign: 'left',
      boxShadow: active ? colors.glow.cyan : 'none',
      transition: 'all 0.18s ease',
    }),

    main: { padding: '24px 28px', maxWidth: 1600, margin: '0 auto' },

    // ── Cards ──────────────────────────────────────────
    card: (extra = {}) => ({
      background: colors.bg.card,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: colors.shadow.sm,
      transition: 'border-color 0.2s ease',
      ...extra,
    }),

    glassCard: (extra = {}) => ({
      background: colors.bg.glass,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: colors.shadow.md,
      ...extra,
    }),

    metricCard: (accentColor, extra = {}) => ({
      background: colors.bg.card,
      border: `1px solid ${colors.border.primary}`,
      borderLeft: `3px solid ${accentColor || colors.brand.cyan}`,
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: colors.shadow.sm,
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      ...extra,
    }),

    // ── KPI ────────────────────────────────────────────
    kpiIconWrap: (color) => ({
      width: 36,
      height: 36,
      borderRadius: 8,
      background: `${color}18`,
      border: `1px solid ${color}30`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }),

    // ── Pill / Badge ───────────────────────────────────
    pill: (color) => ({
      background: `${color}15`,
      color: color,
      border: `1px solid ${color}30`,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
    }),

    badge: (variant = 'default') => {
      const variants = {
        success: { background: colors.semantic.successBg, color: colors.semantic.success,     border: `1px solid ${colors.semantic.success}30` },
        warning: { background: colors.semantic.warningBg, color: colors.semantic.warning,     border: `1px solid ${colors.semantic.warning}30` },
        error:   { background: colors.semantic.errorBg,   color: colors.semantic.error,       border: `1px solid ${colors.semantic.error}30` },
        info:    { background: colors.semantic.infoBg,    color: colors.semantic.info,        border: `1px solid ${colors.semantic.info}30` },
        purple:  { background: colors.brand.purpleLight,  color: colors.brand.purple,         border: `1px solid ${colors.brand.purple}30` },
        default: { background: colors.bg.tertiary,        color: colors.text.secondary,       border: `1px solid ${colors.border.primary}` },
      };
      return {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        ...variants[variant] || variants.default,
      };
    },

    // ── Inputs ─────────────────────────────────────────
    input: {
      padding: '9px 12px',
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 8,
      fontSize: 13,
      fontFamily: 'inherit',
      width: '100%',
      background: colors.bg.secondary,
      color: colors.text.primary,
      outline: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    },

    select: {
      padding: '9px 14px',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border.primary,
      borderRadius: 8,
      fontSize: 13,
      fontFamily: 'inherit',
      background: colors.bg.secondary,
      color: colors.text.primary,
      cursor: 'pointer',
      outline: 'none',
      transition: 'all 0.2s ease',
    },

    // ── Table ──────────────────────────────────────────
    tableHeadCell: {
      padding: '10px 12px',
      textAlign: 'left',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: `1px solid ${colors.border.primary}`,
      color: colors.text.secondary,
      background: colors.bg.tertiary,
      whiteSpace: 'nowrap',
    },

    tableCell: {
      padding: '10px 12px',
      color: colors.text.primary,
      borderBottom: `1px solid ${colors.border.primary}`,
      fontSize: 13,
    },

    // ── Grid ───────────────────────────────────────────
    grid: (template) => ({
      display: 'grid',
      gridTemplateColumns: template,
      gap: 20,
      marginBottom: 24,
    }),

    // ── Buttons ────────────────────────────────────────
    button: {
      primary: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '9px 18px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        background: disabled ? `${colors.brand.cyan}50` : `rgba(0,212,255,0.12)`,
        color: colors.brand.cyan,
        border: `1px solid ${disabled ? `${colors.brand.cyan}30` : `${colors.brand.cyan}50`}`,
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
      }),
      secondary: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        background: colors.bg.secondary,
        color: colors.text.primary,
        border: `1px solid ${colors.border.primary}`,
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease',
      }),
      danger: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        background: `${colors.semantic.error}15`,
        color: colors.semantic.error,
        border: `1px solid ${colors.semantic.error}40`,
        opacity: disabled ? 0.6 : 1,
      }),
      success: (disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'inherit',
        background: `${colors.semantic.success}15`,
        color: colors.semantic.success,
        border: `1px solid ${colors.semantic.success}40`,
        opacity: disabled ? 0.6 : 1,
      }),
    },

    // Legacy flat button aliases
    buttonDanger:  { background: `${colors.semantic.error}15`,   color: colors.semantic.error,   padding: '8px 16px', border: `1px solid ${colors.semantic.error}40`,   borderRadius: 8 },
    buttonSuccess: { background: `${colors.semantic.success}15`, color: colors.semantic.success, padding: '8px 16px', border: `1px solid ${colors.semantic.success}40`, borderRadius: 8 },

    // ── States ─────────────────────────────────────────
    error: {
      background: colors.semantic.errorBg,
      color:      colors.semantic.error,
      padding:    '10px 14px',
      borderRadius: 8,
      marginBottom: 16,
      border: `1px solid ${colors.semantic.error}40`,
      fontSize: 13,
    },

    loading: {
      textAlign: 'center',
      padding: 40,
      color: colors.text.secondary,
    },

    noItems: {
      textAlign: 'center',
      padding: 40,
      color: colors.text.secondary,
      background: colors.bg.tertiary,
      borderRadius: 12,
      border: `1px solid ${colors.border.primary}`,
    },

    // ── Skeleton ────────────────────────────────────────
    skeleton: (w = '100%', h = 20) => ({
      background: `linear-gradient(90deg, ${colors.bg.tertiary} 25%, ${colors.bg.secondary} 50%, ${colors.bg.tertiary} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      height: h,
      width: w,
      borderRadius: 6,
    }),

    // ── Misc ───────────────────────────────────────────
    container: { maxWidth: 1600, margin: '0 auto', padding: 24 },

    headerBox: {
      background: colors.bg.tertiary,
      padding: '16px 20px',
      borderRadius: 10,
      marginBottom: 20,
      borderLeft: `3px solid ${colors.brand.cyan}`,
    },

    title:    { margin: '0 0 8px 0', color: colors.text.primary,   fontSize: 22, fontWeight: 700 },
    subtitle: { margin: 0,           color: colors.text.secondary,   fontSize: 13 },

    tabs: {
      display: 'flex',
      marginBottom: 20,
      borderBottom: `1px solid ${colors.border.primary}`,
      gap: 4,
    },

    tab:        { padding: '10px 20px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, borderBottom: '2px solid transparent', fontFamily: 'inherit' },
    activeTab:  { color: colors.brand.cyan,    borderBottomColor: colors.brand.cyan },
    inactiveTab:{ color: colors.text.secondary, borderBottomColor: 'transparent' },

    cardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
      paddingBottom: 10,
      borderBottom: `1px solid ${colors.border.primary}`,
    },
    cardTitle:    { fontSize: 14, fontWeight: 600, color: colors.text.primary },
    cardSubtitle: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },

    ruleHeader:       { display: 'flex', justifyContent: 'space-between', marginBottom: 14 },
    ruleTitle:        { fontSize: 16, fontWeight: 700, color: colors.brand.cyan },
    ruleSubtitle:     { fontSize: 13, color: colors.text.secondary },
    ruleDescription:  { fontSize: 12, color: colors.text.secondary },
    priorityIndicator:{ padding: '2px 8px', borderRadius: 12, fontSize: 11, background: colors.semantic.infoBg, color: colors.semantic.info },

    footer:      { background: colors.bg.secondary, borderTop: `1px solid ${colors.border.primary}`, marginTop: 40 },
    footerInner: { maxWidth: 1600, margin: '0 auto', padding: '14px 24px' },
  };
};
