import { useEffect, useMemo, useState } from 'react';

import { searchMentionUsers, type MentionUser } from '@/features/social/api/mentions';
import { extractActiveMention } from '@/features/social/mentions';

export function useMentionAutocomplete(value: string, caretPosition: number, currentUserId?: string) {
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const activeMention = useMemo(() => extractActiveMention(value, caretPosition), [caretPosition, value]);

  useEffect(() => {
    if (!activeMention || activeMention.query.length < 1) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchMentionUsers(activeMention.query, currentUserId)
        .then((users) => active && setSuggestions(users))
        .catch(() => active && setSuggestions([]))
        .finally(() => active && setLoading(false));
    }, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeMention, currentUserId]);

  return { activeMention, suggestions, loading };
}
