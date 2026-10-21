interface LaidOutLine {
  text: string;
  width: number;
}

/**
 * Picks the word break that makes a two-line text most even (CSS
 * `text-wrap: balance`), estimating widths from the first layout's average
 * character width. Returns the text with a `\n` at that break, or null when
 * the first layout is already as even as it gets.
 */
export function balancedSplit(text: string, first: LaidOutLine, second: LaidOutLine): string | null {
  const words = text.split(' ');
  const chars = first.text.trimEnd().length + second.text.trimEnd().length;
  if (words.length < 2 || chars === 0) return null;

  const charWidth = (first.width + second.width) / chars;
  let best: string | null = null;
  let bestWidth = first.width - charWidth;
  for (let index = 1; index < words.length; index += 1) {
    const head = words.slice(0, index).join(' ');
    const tail = words.slice(index).join(' ');
    const widest = Math.max(head.length, tail.length) * charWidth;
    if (widest < bestWidth) {
      bestWidth = widest;
      best = `${head}\n${tail}`;
    }
  }
  return best;
}
