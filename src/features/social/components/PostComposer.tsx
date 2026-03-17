import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import { MentionSuggestions } from '@/features/social/components/MentionSuggestions';
import { useMentionAutocomplete } from '@/features/social/hooks/useMentionAutocomplete';
import { applyMention } from '@/features/social/mentions';
import { compressImageFile } from '@/features/social/images';
import { SocialImagePreview } from '@/features/social/components/SocialImagePreview';
import { toast } from 'sonner';

interface AttachedImage {
  blob: Blob;
  previewUrl: string;
  sizeKb: number;
}

function getPastedImageFile(event: React.ClipboardEvent<HTMLTextAreaElement>): File | null {
  const directFile = event.clipboardData.files?.[0];
  if (directFile && directFile.type.startsWith('image/')) {
    return directFile;
  }

  const item = Array.from(event.clipboardData.items ?? []).find((entry) =>
    entry.type.startsWith('image/'),
  );

  return item?.getAsFile() ?? null;
}

interface PostComposerProps {
  onSubmit: (content: string, imageBlob?: Blob) => Promise<void>;
  disabled?: boolean;
  currentUserId?: string;
}

const MAX_LENGTH = 500;

export function PostComposer({ onSubmit, disabled, currentUserId }: PostComposerProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [caretPosition, setCaretPosition] = useState(0);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { activeMention, suggestions, loading } = useMentionAutocomplete({
    value: content,
    caretPosition,
    currentUserId,
  });

  const trimmed = content.trim();
  const canSubmit =
    (trimmed.length > 0 || !!attachedImage) &&
    trimmed.length <= MAX_LENGTH &&
    !submitting &&
    !disabled;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (attachedImage) {
        await onSubmit(trimmed, attachedImage.blob);
      } else {
        await onSubmit(trimmed);
      }
      setContent('');
      if (attachedImage) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
      setAttachedImage(null);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (attachedImage) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
    };
  }, [attachedImage]);

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = getPastedImageFile(event);
    if (!file) return;

    event.preventDefault();

    if (attachedImage) {
      toast.error('Możesz dodać maksymalnie jedno zdjęcie do posta');
      return;
    }

    try {
      const compressed = await compressImageFile(file);
      const previewUrl = URL.createObjectURL(compressed.blob);
      setAttachedImage({
        blob: compressed.blob,
        previewUrl,
        sizeKb: Math.round(compressed.blob.size / 1024),
      });
      toast.success('Zdjęcie zostało dodane i skompresowane');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się dodać zdjęcia';
      toast.error(message);
    }
  };

  const handleRemoveImage = () => {
    if (!attachedImage) return;
    URL.revokeObjectURL(attachedImage.previewUrl);
    setAttachedImage(null);
  };

  const handleMentionSelect = (username: string) => {
    if (!activeMention) return;
    const next = applyMention(content, activeMention, username);
    setContent(next.value);
    setCaretPosition(next.caret);

    window.requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <div className="bg-card rounded-xl card-shadow p-4">
      <textarea
        ref={textareaRef}
        className="w-full resize-none bg-transparent border border-border rounded-lg p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        rows={3}
        placeholder="Co nowego?"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setCaretPosition(e.target.selectionStart ?? e.target.value.length);
        }}
        onPaste={(e) => {
          void handlePaste(e);
        }}
        onSelect={(e) => {
          const target = e.target as HTMLTextAreaElement;
          setCaretPosition(target.selectionStart ?? target.value.length);
        }}
        maxLength={MAX_LENGTH}
        disabled={submitting || disabled}
        aria-label="Treść posta"
      />
      {attachedImage && (
        <SocialImagePreview
          imageUrl={attachedImage.previewUrl}
          imageKb={attachedImage.sizeKb}
          onRemove={handleRemoveImage}
        />
      )}
      {activeMention && (
        <div className="mt-2">
          <MentionSuggestions
            loading={loading}
            users={suggestions}
            onSelect={handleMentionSelect}
          />
        </div>
      )}
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
