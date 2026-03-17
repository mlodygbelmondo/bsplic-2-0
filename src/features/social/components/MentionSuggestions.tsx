import { Loader2 } from 'lucide-react';
import type { MentionUser } from '@/features/social/api/mentions';

interface MentionSuggestionsProps {
  loading: boolean;
  users: MentionUser[];
  onSelect: (username: string) => void;
}

export function MentionSuggestions({ loading, users, onSelect }: MentionSuggestionsProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-popover p-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Szukanie użytkowników...
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-popover p-1">
      <div className="text-[11px] text-muted-foreground px-2 py-1">Wspomnij użytkownika</div>
      <div className="space-y-0.5">
        {users.map((user) => (
          <button
            key={user.id}
            type="button"
            className="w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
            onClick={() => onSelect(user.username)}
            aria-label={`@${user.username}`}
          >
            @{user.username}
          </button>
        ))}
      </div>
    </div>
  );
}
