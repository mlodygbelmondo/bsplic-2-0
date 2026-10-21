import { hsl } from '@/theme';

/** Root font size of the web layout: every `rem` in `jackpotDrawPage.css` is 16 px. */
export const REM = 16;

/** Shared draw-page colors (`jackpotDrawPage.css`, identical in both themes). */
export const DRAW_COLORS = {
  text: hsl(0, 0, 96),
  heading: hsl(0, 0, 98),
  muted: hsl(0, 0, 66),
  gold: hsl(43, 100, 84),
  goldSoft: hsl(43, 100, 88),
  goldBorder: hsl(43, 100, 60, 0.28),
  hotText: hsl(24, 14, 8),
  ticketInk: hsl(25, 52, 15),
};

/** Transparent stop in the same hue, so gradients do not fade through black like `transparent` can. */
export const fade = (h: number, s: number, l: number) => hsl(h, s, l, 0);

/** Phone layout: the replay shell is `min(100% - 0.75rem, …)` wide with 0.8rem inline padding. */
export function getDrawLayout(windowWidth: number) {
  const shellWidth = windowWidth - 0.75 * REM;
  return { shellWidth, contentWidth: shellWidth - 2 - 2 * 0.8 * REM };
}
