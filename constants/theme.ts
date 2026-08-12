export const colors = {
  background: '#0A0A0A',
  surface: '#141414',
  surfaceElevated: '#1E1E1E',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textMuted: '#6B6B6B',
  accent: '#C8FF00',
  accentMuted: 'rgba(200, 255, 0, 0.15)',
  danger: '#FF4D4D',
  success: '#4ADE80',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

/** Loaded via useFonts in root layout — Bebas Neue (display) + DM Sans (UI). */
export const fonts = {
  display: 'BebasNeue_400Regular',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_600SemiBold',
  sansBold: 'DMSans_700Bold',
} as const;

export const typography = {
  hero: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  label: { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  /** Premium section headers (Studio News style). */
  section: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: colors.text,
  },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 2.8,
    textTransform: 'uppercase' as const,
  },
} as const;
