import { View, type ViewProps } from 'react-native';

import { createStyles } from '@/theme';

export type SurfaceVariant = 'card' | 'app' | 'sub' | 'bookmaker' | 'plain';

export interface SurfaceProps extends ViewProps {
  /**
   * `card` = shadcn Card (`rounded-lg border bg-card shadow-sm`),
   * `app` = `.app-surface`, `sub` = `.app-subsurface`,
   * `bookmaker` = `.card-shadow.bg-card`, `plain` = bg-card only.
   */
  variant?: SurfaceVariant;
}

export function Surface({ variant = 'card', style, ...props }: SurfaceProps) {
  const styles = useStyles();
  return <View style={[styles.base, styles[variant], style]} {...props} />;
}

const useStyles = createStyles(({ colors, gradients, shadows, radius, scheme }) => ({
  base: { borderCurve: 'continuous', borderRadius: radius.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
  },
  app: {
    borderWidth: 1,
    borderColor: scheme === 'dark' ? `${colors.border}e6` : colors.border,
    backgroundColor: colors.card,
    backgroundImage: gradients.appSurface,
    boxShadow: shadows.appSurface,
  },
  sub: {
    borderWidth: 1,
    borderColor: `${colors.border}b8`,
    // `.app-subsurface`: muted at 52%, 60% under `.light`.
    backgroundColor: `${colors.muted}${scheme === 'dark' ? '85' : '99'}`,
  },
  bookmaker: {
    borderWidth: 1,
    borderColor: scheme === 'dark' ? `${colors.border}d1` : colors.border,
    backgroundColor: colors.card,
    backgroundImage: gradients.bookmakerSurface,
    boxShadow: shadows.card,
  },
  plain: { backgroundColor: colors.card },
}));
