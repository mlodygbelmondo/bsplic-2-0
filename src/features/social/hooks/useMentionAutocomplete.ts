import { useEffect, useMemo, useState } from 'react';
import { searchMentionUsers, type MentionUser } from '@/features/social/api/mentions';
import { extractActiveMention, type ActiveMention } from '@/features/social/mentions';

interface UseMentionAutocompleteParams {
  value: string;
  caretPosition: number;
  currentUserId?: string;
  minQueryLength?: number;
}

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
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);

  const activeMention = useMemo(
    () => extractActiveMention(value, caretPosition),
    [value, caretPosition],
  );

  useEffect(() => {
    if (!activeMention || activeMention.query.length < minQueryLength) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchMentionUsers(activeMention.query, currentUserId);
        if (!cancelled) {
          setSuggestions(users);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [activeMention, currentUserId, minQueryLength]);

  return {
    activeMention,
    suggestions,
    loading,
  };
}
