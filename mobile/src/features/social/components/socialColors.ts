import { alpha, socialMobileColors } from '@/theme';

/**
 * The phone Social palette (`.social-mobile-page` overrides in the web
 * `index.css`), used in both app themes, plus the tints the feed needs.
 * `success`/`destructive` are not overridden on the web, so they come from
 * the app theme (`palette.colors`).
 */
export const social = {
  ...socialMobileColors,
  popover: '#ffffff',
  /** `bg-primary/10`. */
  primarySoft: alpha(socialMobileColors.primary, 0.1),
  /** `border-primary/40`. */
  primaryBorder: alpha(socialMobileColors.primary, 0.4),
  /** `bg-muted-foreground/10`. */
  mutedForegroundSoft: alpha(socialMobileColors.mutedForeground, 0.1),
  /** `border-border/70`. */
  borderSoft: alpha(socialMobileColors.border, 0.7),
  /** `border-border/72` (reaction picker). */
  pickerBorder: alpha(socialMobileColors.border, 0.72),
} as const;
