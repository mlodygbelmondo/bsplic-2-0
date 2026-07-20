export interface ActiveMention {
  query: string;
  start: number;
  end: number;
}

const MENTION_PATTERN = /(?:^|\s)@([A-Za-z0-9_.-]{0,32})$/;

export function extractActiveMention(value: string, caretPosition: number): ActiveMention | null {
  const end = Math.max(0, Math.min(caretPosition, value.length));
  const beforeCaret = value.slice(0, end);
  const match = beforeCaret.match(MENTION_PATTERN);
  const start = beforeCaret.lastIndexOf('@');
  if (!match || start < 0) return null;
  return { query: match[1] ?? '', start, end };
}

export function applyMention(value: string, mention: Pick<ActiveMention, 'start' | 'end'>, username: string) {
  const replacement = `@${username} `;
  return {
    value: value.slice(0, mention.start) + replacement + value.slice(mention.end),
    caret: mention.start + replacement.length,
  };
}
