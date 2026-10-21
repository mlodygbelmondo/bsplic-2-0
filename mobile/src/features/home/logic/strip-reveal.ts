/** Room kept beside an item scrolled into view (web `REVEAL_MARGIN_PX`). */
export const REVEAL_MARGIN = 24;

export interface StripMetrics {
  /** Current horizontal scroll offset. */
  offset: number;
  /** Visible width of the strip. */
  viewportWidth: number;
  /** Total scrollable content width. */
  contentWidth: number;
}

/**
 * Port of the web `revealInStrip` (`CategoryRail.tsx`): the offset that shows
 * an item with some room on either side, or `null` when it is already in view.
 * Unlike the browser, a native scroll view does not clamp programmatic
 * offsets, so the result stays within the scrollable range.
 */
export function getStripRevealOffset(
  strip: StripMetrics,
  item: { x: number; width: number },
  margin = REVEAL_MARGIN,
): number | null {
  const start = item.x - margin;
  const end = item.x + item.width + margin;
  const maxOffset = Math.max(0, strip.contentWidth - strip.viewportWidth);
  let target: number | null = null;
  if (start < strip.offset) {
    target = start;
  } else if (end > strip.offset + strip.viewportWidth) {
    target = end - strip.viewportWidth;
  }
  if (target === null) return null;
  return Math.min(maxOffset, Math.max(0, target));
}
