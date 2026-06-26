import { Platform, type ViewStyle } from 'react-native';

/**
 * SafepayAI palette — dark, AI-forward fintech.
 * Use Brand.* tokens directly; the app is dark-mode only.
 */
export const Brand = {
  // Brand
  primary: '#06B6D4',        // cyan — buttons, links, active states
  primaryDeep: '#0891B2',    // pressed/hover cyan
  primarySoft: 'rgba(6,182,212,0.14)', // tinted backgrounds
  secondary: '#2563EB',      // blue — charts, trust accents
  secondarySoft: 'rgba(37,99,235,0.14)',
  ai: '#8B5CF6',             // purple — AI badges, intelligence indicators
  aiSoft: 'rgba(139,92,246,0.16)',

  // Surfaces
  bg: '#0B1220',                         // main app background
  surface: 'rgba(255,255,255,0.04)',     // cards · subtle frosted lift over bg
  surfaceSolid: '#111827',               // when you need an opaque slate (modals, tab bar bg, etc.)
  surfaceElevated: '#1E293B',            // modals, navigation, popups
  border: 'rgba(255,255,255,0.08)',      // brighter so card edges remain visible
  borderStrong: '#334155',

  // Status
  success: '#10B981',
  successSoft: 'rgba(16,185,129,0.14)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245,158,11,0.14)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.14)',
  critical: '#DC2626',
  criticalSoft: 'rgba(220,38,38,0.16)',

  // Text
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#64748B',
  textOnPrimary: '#0B1220', // dark text on cyan buttons (max contrast)
};

/**
 * Semantic palette — single source of truth for theme-aware values.
 * Kept under `Colors.light`/`Colors.dark` for compatibility with existing
 * theme-color hooks, but both point at the same dark palette.
 */
const darkPalette = {
  text: Brand.text,
  textMuted: Brand.textMuted,
  background: Brand.bg,
  surface: Brand.surface,
  surfaceElevated: Brand.surfaceElevated,
  tint: Brand.primary,
  accent: Brand.primary,
  border: Brand.border,
  icon: Brand.textSecondary,
  tabIconDefault: Brand.textMuted,
  tabIconSelected: Brand.primary,
};

export const Colors = {
  light: darkPalette,
  dark: darkPalette,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  pill: 999,
};

/**
 * Elevation tokens. On dark UIs shadows alone aren't enough — pair `bg`
 * with a slightly lighter `surface` for the visual lift.
 */
export const Shadow: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 16,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
