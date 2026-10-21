import { useTheme, type Palette } from '@/theme';
import type { CouponHistoryEntry } from '@/types/database';

/** CSS `color-mix(in srgb, a weight, b)` for opaque `#rrggbb` colors. */
function mix(a: string, b: string, weight: number): string {
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const [r, g, bl] = [0, 1, 2].map((index) => Math.round(channel(a, index) * weight + channel(b, index) * (1 - weight)));
  return `rgb(${r}, ${g}, ${bl})`;
}

export interface ReplayTone {
  /** `.text-muted-foreground` inside `.replay-content`. */
  muted: string;
  won: string;
  lost: string;
}

const tones: Partial<Record<Palette['scheme'], ReplayTone>> = {};

/**
 * `replay.css`: theme status colours are too light for small text on the light
 * card, so the light theme darkens muted text, wins and losses.
 */
export function replayTone({ scheme, colors }: Palette): ReplayTone {
  const cached = tones[scheme];
  if (cached) return cached;
  const tone =
    scheme === 'dark'
      ? { muted: colors.mutedForeground, won: colors.success, lost: colors.destructive }
      : {
          muted: mix(colors.mutedForeground, colors.foreground, 0.9),
          won: mix(colors.success, '#000000', 0.65),
          lost: mix(colors.destructive, '#000000', 0.75),
        };
  tones[scheme] = tone;
  return tone;
}

export function useReplayTone(): ReplayTone {
  return replayTone(useTheme());
}

/** `.replay-status[data-status]`. */
export function statusColor(tone: ReplayTone, status: CouponHistoryEntry['status']): string {
  if (status === 'won') return tone.won;
  if (status === 'lost') return tone.lost;
  return tone.muted;
}
