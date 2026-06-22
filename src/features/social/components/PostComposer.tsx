import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ImagePlus, Send, Loader2 } from 'lucide-react';
import { MentionSuggestions } from '@/features/social/components/MentionSuggestions';
import { useMentionAutocomplete } from '@/features/social/hooks/useMentionAutocomplete';
import { applyMention } from '@/features/social/mentions';
import { compressImageFile } from '@/features/social/images';
import { SocialImagePreview } from '@/features/social/components/SocialImagePreview';
import { cn } from '@/lib/utils';
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
  currentUsername?: string;
  currentUserAvatarUrl?: string | null;
}

interface ComposerDraftState {
  content: string;
  attachedImage: AttachedImage | null;
}

const MAX_LENGTH = 500;
const COMPACT_COMPOSER_BREAKPOINT = 640;

function useIsCompactComposerViewport() {
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window === 'undefined' ? false : window.innerWidth < COMPACT_COMPOSER_BREAKPOINT,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(
      `(max-width: ${COMPACT_COMPOSER_BREAKPOINT - 1}px)`,
    );
    const updateViewport = () => {
      setIsCompactViewport(window.innerWidth < COMPACT_COMPOSER_BREAKPOINT);
    };

    mediaQuery.addEventListener('change', updateViewport);
    updateViewport();

    return () => {
      mediaQuery.removeEventListener('change', updateViewport);
    };
  }, []);

  return isCompactViewport;
}

export function PostComposer({
  onSubmit,
  disabled,
  currentUserId,
  currentUsername,
  currentUserAvatarUrl,
}: PostComposerProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [draft, setDraft] = useState<ComposerDraftState>({
    content: '',
    attachedImage: null,
  });
  const isCompactViewport = useIsCompactComposerViewport();

  if (isCompactViewport) {
    return (
      <div
        data-testid="post-composer"
        data-state={mobileOpen ? 'open' : 'trigger'}
        className="social-compose-entry"
      >
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Utwórz post"
              disabled={disabled}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-60"
            >
              <ComposerAvatar
                username={currentUsername}
                avatarUrl={currentUserAvatarUrl}
                className="h-10 w-10"
              />
              <span className="min-w-0 flex-1 rounded-full bg-muted px-4 py-2.5 text-[15px] font-medium leading-none text-muted-foreground">
                Co nowego?
              </span>
              <span
                data-testid="post-composer-media-affordance"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-emerald-600"
                aria-hidden="true"
              >
                <ImagePlus className="h-6 w-6" />
              </span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="social-composer-sheet max-h-[calc(var(--app-viewport-height,100svh)-0.75rem)] overflow-hidden rounded-t-[20px] border-border bg-background p-0 shadow-2xl sm:hidden"
          >
            <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-center">
              <SheetTitle className="text-base font-bold">
                Utwórz post
              </SheetTitle>
            </SheetHeader>
            <ComposerEditor
              onSubmit={onSubmit}
              disabled={disabled}
              currentUserId={currentUserId}
              currentUsername={currentUsername}
              currentUserAvatarUrl={currentUserAvatarUrl}
              variant="sheet"
              draft={draft}
              onDraftChange={setDraft}
              autoFocus
              onSubmitted={() => {
                setDraft({ content: '', attachedImage: null });
                setMobileOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <ComposerEditor
      onSubmit={onSubmit}
      disabled={disabled}
      currentUserId={currentUserId}
      currentUsername={currentUsername}
      currentUserAvatarUrl={currentUserAvatarUrl}
      variant="desktop"
      rootTestId="post-composer"
      draft={draft}
      onDraftChange={setDraft}
      onSubmitted={() => setDraft({ content: '', attachedImage: null })}
    />
  );
}

interface ComposerEditorProps extends PostComposerProps {
  variant: 'desktop' | 'sheet';
  draft: ComposerDraftState;
  onDraftChange: (draft: ComposerDraftState) => void;
  autoFocus?: boolean;
  onSubmitted?: () => void;
  rootTestId?: string;
}

function ComposerEditor({
  onSubmit,
  disabled,
  currentUserId,
  currentUsername,
  currentUserAvatarUrl,
  variant,
  draft,
  onDraftChange,
  autoFocus = false,
  onSubmitted,
  rootTestId,
}: ComposerEditorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [caretPosition, setCaretPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isSheet = variant === 'sheet';
  const { content, attachedImage } = draft;

  const setContent = (content: string) => {
    onDraftChange({ ...draft, content });
  };

  const setAttachedImage = (attachedImage: AttachedImage | null) => {
    onDraftChange({ ...draft, attachedImage });
  };

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
      if (attachedImage) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
      onSubmitted?.();
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!autoFocus) return;
    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timeout);
  }, [autoFocus]);

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
    <div
      data-testid={rootTestId}
      data-state="expanded"
      className={cn(
        isSheet
          ? 'space-y-3 overflow-y-auto px-4 pb-[calc(1rem+var(--safe-area-bottom))] pt-4'
          : 'app-surface social-edge-surface overflow-hidden rounded-xl p-4',
      )}
    >
      {isSheet && (
        <div className="flex items-center gap-3">
          <ComposerAvatar
            username={currentUsername}
            avatarUrl={currentUserAvatarUrl}
            className="h-10 w-10"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {currentUsername || 'Ty'}
            </p>
            <p className="text-xs text-muted-foreground">
              Post w feedzie
            </p>
          </div>
        </div>
      )}
      <textarea
        ref={textareaRef}
        className={cn(
          'w-full resize-none placeholder:text-muted-foreground focus:outline-none',
          isSheet
            ? 'min-h-[10rem] rounded-2xl border-0 bg-muted px-4 py-3 text-base leading-6 focus:ring-0'
            : 'rounded-lg border border-border bg-transparent px-3 py-2 text-sm transition-[min-height,padding] duration-200 focus:ring-2 focus:ring-primary/30 sm:p-3',
        )}
        rows={isSheet ? 5 : 3}
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
      <div className={cn('flex items-center justify-between', isSheet ? 'pt-1' : 'mt-2')}>
        <span
          className={`text-xs ${
            trimmed.length > MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {trimmed.length}/{MAX_LENGTH}
        </span>
        <Button
          size="sm"
          className={cn(isSheet && 'rounded-full px-4')}
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

interface ComposerAvatarProps {
  username?: string;
  avatarUrl?: string | null;
  className?: string;
}

function ComposerAvatar({ username, avatarUrl, className }: ComposerAvatarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const hasAvatar = Boolean(avatarUrl) && !avatarFailed;
  const fallback = (username || 'T').charAt(0).toUpperCase();

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary',
        className,
      )}
      aria-hidden="true"
    >
      {hasAvatar ? (
        <img
          src={avatarUrl ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
