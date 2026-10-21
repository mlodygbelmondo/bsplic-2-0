import { useEffect, useState } from 'react';

import { searchMentionUsers, type MentionUser } from './api';
import { extractActiveMention, type ActiveMention } from './mentions';

/** Web debounce before searching. */
const MENTION_SEARCH_DEBOUNCE_MS = 120;

interface UseMentionAutocompleteParams {
  value: string;
  caretPosition: number;
  currentUserId?: string;
  minQueryLength?: number;
}

interface MentionResult {
  query: string;
  users: MentionUser[];
}

/**
 * Debounced `@mention` search for the caret's token (web
 * `useMentionAutocomplete`): a bare `@` shows nothing, every keystroke cancels
 * the previous request and failures show no suggestions.
 */
export function useMentionAutocomplete({
  value,
  caretPosition,
  currentUserId,
  minQueryLength = 1,
}: UseMentionAutocompleteParams): {
  activeMention: ActiveMention | null;
  suggestions: MentionUser[];
  loading: boolean;
} {
  const activeMention = extractActiveMention(value, caretPosition);
  const query = activeMention && activeMention.query.length >= minQueryLength ? activeMention.query : null;
  const [result, setResult] = useState<MentionResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Leaving the token clears the list, like the web.
  if (query === null && (result !== null || loading)) {
    setResult(null);
    setLoading(false);
  }

  useEffect(() => {
    if (query === null) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchMentionUsers(query, currentUserId);
        if (!cancelled) setResult({ query, users });
      } catch {
        if (!cancelled) setResult({ query, users: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, MENTION_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, currentUserId]);

  return { activeMention, suggestions: result?.users ?? [], loading };
}
