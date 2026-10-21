import { alpha, createStyles } from '@/theme';

/**
 * `.app-surface.rounded-xl` and `.app-subsurface` from `src/index.css`
 * (light theme: plain card, subsurface muted at 60% instead of 52%).
 */
export const useSurfaceStyles = createStyles(({ colors, gradients, shadows, scheme }) => ({
  card: {
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: scheme === 'dark' ? alpha(colors.border, 0.9) : colors.border,
    backgroundColor: colors.card,
    backgroundImage: gradients.appSurface,
    boxShadow: shadows.appSurface,
  },
  sub: {
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.72),
    backgroundColor: alpha(colors.muted, scheme === 'dark' ? 0.52 : 0.6),
  },
}));
