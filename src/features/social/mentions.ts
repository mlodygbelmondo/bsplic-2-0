export interface ActiveMention {
  query: string;
  start: number;
  end: number;
}

const MENTION_PATTERN = /(?:^|\s)@([A-Za-z0-9_.-]{0,32})$/;

export function extractActiveMention(value: string, caretPosition: number): ActiveMention | null {
  const safeCaret = Math.max(0, Math.min(caretPosition, value.length));
  const beforeCaret = value.slice(0, safeCaret);
  const match = beforeCaret.match(MENTION_PATTERN);

  if (!match) return null;

  const atIndex = beforeCaret.lastIndexOf('@');
  if (atIndex === -1) return null;

  const query = match[1] ?? '';
  return {
    query,
    start: atIndex,
    end: safeCaret,
  };
}

export function applyMention(
  value: string,
  mention: Pick<ActiveMention, 'start' | 'end'>,
  username: string,
): { value: string; caret: number } {
  const replacement = `@${username} `;
  const nextValue = value.slice(0, mention.start) + replacement + value.slice(mention.end);
  const nextCaret = mention.start + replacement.length;

  return {
    value: nextValue,
    caret: nextCaret,
  };
}
