import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';

interface PostComposerProps {
  onSubmit: (content: string) => Promise<void>;
  disabled?: boolean;
}

const MAX_LENGTH = 500;

export function PostComposer({ onSubmit, disabled }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = content.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LENGTH && !submitting && !disabled;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl card-shadow p-4">
      <textarea
        className="w-full resize-none bg-transparent border border-border rounded-lg p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={3}
        placeholder="Co nowego?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={MAX_LENGTH}
        disabled={submitting || disabled}
        aria-label="Treść posta"
      />
      <div className="flex items-center justify-between mt-2">
        <span
          className={`text-xs ${
            trimmed.length > MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {trimmed.length}/{MAX_LENGTH}
        </span>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="Opublikuj post"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Send className="h-4 w-4 mr-1" />
          )}
          Opublikuj
        </Button>
      </div>
    </div>
  );
}
