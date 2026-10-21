/** Active `@mention` extraction and replacement (web `mentions.ts`). */

export interface ActiveMention {
  query: string;
  start: number;
  end: number;
}

const MENTION_PATTERN = /(?:^|\s)@([A-Za-z0-9_.-]{0,32})$/;

/** The `@query` token that ends at the caret, or null when the caret is outside one. */
export function extractActiveMention(value: string, caretPosition: number): ActiveMention | null {
  const safeCaret = Math.max(0, Math.min(caretPosition, value.length));
  const beforeCaret = value.slice(0, safeCaret);
  const match = beforeCaret.match(MENTION_PATTERN);

  if (!match) return null;

  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex === -1) return null;

  return {
    query: match[1] ?? '',
    start: atIndex,
    end: safeCaret,
  };
}

/** Replaces the `[start, end)` span with `@username ` and returns the caret after the space. */
export function applyMention(
  value: string,
  mention: Pick<ActiveMention, 'start' | 'end'>,
  username: string,
): { value: string; caret: number } {
  const replacement = `@${username} `;
  return {
    value: value.slice(0, mention.start) + replacement + value.slice(mention.end),
    caret: mention.start + replacement.length,
  };
}
