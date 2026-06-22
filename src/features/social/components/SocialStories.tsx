import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Plus,
  Send,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SocialImagePreview } from '@/features/social/components/SocialImagePreview';
import { parseSocialContent } from '@/features/social/content';
import { compressImageFile, getSocialImageUrl } from '@/features/social/images';
import { cn } from '@/lib/utils';
import type { SocialStory } from '@/types/database';
import { toast } from 'sonner';

interface AttachedStoryImage {
  blob: Blob;
  previewUrl: string;
  sizeKb: number;
}

interface SocialStoriesProps {
  stories: SocialStory[];
  currentUsername: string;
  currentAvatarUrl: string | null;
  onCreateStory: (content: string, imageBlob?: Blob) => Promise<void>;
  disabled?: boolean;
}

const STORY_TEXT_MAX_LENGTH = 500;
const STORY_VIEW_MS = 7000;

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

function isStoryActive(story: SocialStory, now: number) {
  return new Date(story.expires_at).getTime() > now;
}

function formatStoryAge(createdAt: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000),
  );

  if (minutes < 1) return 'teraz';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} godz.`;
}

function formatStoryTimeLeft(expiresAt: string) {
  const minutes = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000),
  );

  if (minutes <= 1) return 'znika za chwilę';
  if (minutes < 60) return `znika za ${minutes} min`;
  return `znika za ${Math.ceil(minutes / 60)} godz.`;
}

export function SocialStories({
  stories,
  currentUsername,
  currentAvatarUrl,
  onCreateStory,
  disabled,
}: SocialStoriesProps) {
  const [now, setNow] = useState(() => Date.now());
  const [createOpen, setCreateOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);

  const activeStories = useMemo(
    () => stories.filter((story) => isStoryActive(story, now)),
    [now, stories],
  );
  const selectedStory = activeStories[selectedStoryIndex] ?? null;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedStoryIndex < activeStories.length) return;
    setSelectedStoryIndex(Math.max(0, activeStories.length - 1));
  }, [activeStories.length, selectedStoryIndex]);

  useEffect(() => {
    if (!viewerOpen || !selectedStory) return;

    const timeout = window.setTimeout(() => {
      if (selectedStoryIndex < activeStories.length - 1) {
        setSelectedStoryIndex((current) => current + 1);
      } else {
        setViewerOpen(false);
      }
    }, STORY_VIEW_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeStories.length, selectedStory, selectedStoryIndex, viewerOpen]);

  const openStory = (index: number) => {
    setSelectedStoryIndex(index);
    setViewerOpen(true);
  };

  return (
    <>
      <div
        data-testid="social-stories-strip"
        className="social-facebook-stories mb-2 flex gap-2 overflow-x-auto px-2 pb-2 sm:hidden"
      >
        <button
          type="button"
          className="social-story-tile social-story-create"
          aria-label="Utwórz relację"
          onClick={() => setCreateOpen(true)}
          disabled={disabled}
        >
          <span className="social-story-create-image">
            <StoryImage
              username={currentUsername}
              avatarUrl={currentAvatarUrl}
              className="h-full w-full"
            />
          </span>
          <span className="social-story-create-plus">
            <Plus className="h-4 w-4" />
          </span>
          <span
            className="social-story-label"
            data-label="Utwórz relację"
            aria-hidden="true"
          />
        </button>

        {activeStories.map((story, index) => (
          <button
            key={story.id}
            type="button"
            className="social-story-tile"
            aria-label={`Otwórz relację ${story.username}`}
            onClick={() => openStory(index)}
          >
            <span className="social-story-image">
              <StoryCoverImage story={story} />
            </span>
            <span className="social-story-avatar-ring">
              <StoryImage
                username={story.username}
                avatarUrl={story.avatar_url ?? null}
                className="h-full w-full"
              />
            </span>
            <span
              className="social-story-label"
              data-label={story.username}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <StoryComposerSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        currentUsername={currentUsername}
        currentAvatarUrl={currentAvatarUrl}
        onCreateStory={onCreateStory}
        disabled={disabled}
      />

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        {selectedStory && (
          <StoryViewer
            story={selectedStory}
            storyIndex={selectedStoryIndex}
            storyCount={activeStories.length}
            onPrevious={() =>
              setSelectedStoryIndex((current) => Math.max(0, current - 1))
            }
            onNext={() => {
              if (selectedStoryIndex < activeStories.length - 1) {
                setSelectedStoryIndex((current) => current + 1);
              } else {
                setViewerOpen(false);
              }
            }}
          />
        )}
      </Dialog>
    </>
  );
}

interface StoryComposerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUsername: string;
  currentAvatarUrl: string | null;
  onCreateStory: (content: string, imageBlob?: Blob) => Promise<void>;
  disabled?: boolean;
}

function StoryComposerSheet({
  open,
  onOpenChange,
  currentUsername,
  currentAvatarUrl,
  onCreateStory,
  disabled,
}: StoryComposerSheetProps) {
  const [content, setContent] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedStoryImage | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const trimmed = content.trim();
  const canSubmit =
    (trimmed.length > 0 || !!attachedImage) &&
    trimmed.length <= STORY_TEXT_MAX_LENGTH &&
    !submitting &&
    !disabled;

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 150);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (attachedImage) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
    };
  }, [attachedImage]);

  const resetDraft = () => {
    setContent('');
    setAttachedImage(null);
  };

  const attachImage = async (file: File) => {
    if (attachedImage) {
      toast.error('Możesz dodać maksymalnie jedno zdjęcie do relacji');
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nie udało się dodać zdjęcia';
      toast.error(message);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreateStory(trimmed, attachedImage?.blob);
      resetDraft();
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nie udało się opublikować relacji';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetDraft();
      }}
    >
      <SheetContent
        side="bottom"
        className="social-story-composer-sheet max-h-[calc(var(--app-viewport-height,100svh)-0.75rem)] overflow-hidden rounded-t-[20px] border-border bg-background p-0 shadow-2xl sm:hidden"
      >
        <SheetHeader className="border-b border-border px-4 pb-3 pt-4 text-center">
          <SheetTitle className="text-base font-bold">
            Utwórz relację
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 overflow-y-auto px-4 pb-[calc(1rem+var(--safe-area-bottom))] pt-4">
          <div className="flex items-center gap-3">
            <StoryImage
              username={currentUsername}
              avatarUrl={currentAvatarUrl}
              className="h-10 w-10 rounded-full"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {currentUsername || 'Ty'}
              </p>
              <p className="text-xs text-muted-foreground">
                Relacja zniknie po 24 godz.
              </p>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className="min-h-[9rem] w-full resize-none rounded-2xl border-0 bg-muted px-4 py-3 text-base leading-6 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Napisz coś..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onPaste={(event) => {
              const file = getPastedImageFile(event);
              if (!file) return;
              event.preventDefault();
              void attachImage(file);
            }}
            maxLength={STORY_TEXT_MAX_LENGTH}
            disabled={submitting || disabled}
            aria-label="Treść relacji"
          />

          {attachedImage && (
            <SocialImagePreview
              imageUrl={attachedImage.previewUrl}
              imageKb={attachedImage.sizeKb}
              onRemove={() => {
                setAttachedImage(null);
              }}
            />
          )}

          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="story-image-input"
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10',
                (attachedImage || submitting || disabled) &&
                  'pointer-events-none opacity-50',
              )}
            >
              <ImagePlus className="h-5 w-5" />
              Dodaj zdjęcie
            </label>
            <input
              id="story-image-input"
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Dodaj zdjęcie do relacji"
              disabled={!!attachedImage || submitting || disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                void attachImage(file);
              }}
            />

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-xs',
                  trimmed.length > STORY_TEXT_MAX_LENGTH
                    ? 'text-destructive'
                    : 'text-muted-foreground',
                )}
              >
                {trimmed.length}/{STORY_TEXT_MAX_LENGTH}
              </span>
              <Button
                size="sm"
                className="rounded-full px-4"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                aria-label="Opublikuj relację"
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-1 h-4 w-4" />
                )}
                Opublikuj
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface StoryViewerProps {
  story: SocialStory;
  storyIndex: number;
  storyCount: number;
  onPrevious: () => void;
  onNext: () => void;
}

function StoryViewer({
  story,
  storyIndex,
  storyCount,
  onPrevious,
  onNext,
}: StoryViewerProps) {
  const parsed = parseSocialContent(story.content);
  const imageUrl = parsed.imagePath ? getSocialImageUrl(parsed.imagePath) : null;
  const text = parsed.text.trim();

  return (
    <DialogContent
      hideCloseButton
      className="social-story-viewer fixed inset-0 !left-0 !top-0 h-[var(--app-viewport-height,100svh)] w-screen max-w-none !translate-x-0 !translate-y-0 gap-0 overflow-hidden rounded-none border-0 bg-neutral-950 p-0 text-white shadow-none data-[state=open]:slide-in-from-bottom-6 data-[state=closed]:slide-out-to-bottom-6 sm:!left-[50%] sm:!top-[50%] sm:h-[min(88svh,760px)] sm:w-[min(420px,calc(100vw-2rem))] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-[1.4rem]"
    >
      <DialogTitle className="sr-only">Relacja {story.username}</DialogTitle>
      <div className="relative h-full w-full overflow-hidden bg-neutral-950">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,hsl(var(--primary)/0.9),transparent_32%),linear-gradient(150deg,#160707_0%,#451010_52%,#09090b_100%)]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/72 via-black/18 to-black/78" />

        <div className="absolute left-3 right-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-10">
          <div className="mb-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${storyCount}, minmax(0, 1fr))` }}>
            {Array.from({ length: storyCount }).map((_, index) => (
              <span
                key={index}
                className="h-1 overflow-hidden rounded-full bg-white/35"
              >
                <span
                  className={cn(
                    'block h-full rounded-full bg-white',
                    index < storyIndex && 'w-full',
                    index === storyIndex && 'social-story-progress',
                    index > storyIndex && 'w-0',
                  )}
                />
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <StoryImage
              username={story.username}
              avatarUrl={story.avatar_url ?? null}
              className="h-10 w-10 rounded-full ring-2 ring-primary"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">
                {story.username}
              </p>
              <p className="truncate text-xs font-medium text-white/72">
                {formatStoryAge(story.created_at)} · {formatStoryTimeLeft(story.expires_at)}
              </p>
            </div>
            <DialogClose className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/50">
              <X className="h-5 w-5" />
              <span className="sr-only">Zamknij relację</span>
            </DialogClose>
          </div>
        </div>

        {storyIndex > 0 && (
          <button
            type="button"
            aria-label="Poprzednia relacja"
            onClick={onPrevious}
            className="absolute inset-y-24 left-0 z-20 flex w-1/3 items-center justify-start text-white sm:inset-y-auto sm:left-3 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2 sm:justify-center sm:rounded-full sm:bg-black/35"
          >
            <ChevronLeft className="hidden h-5 w-5 sm:block" />
          </button>
        )}

        {storyIndex < storyCount - 1 && (
          <button
            type="button"
            aria-label="Następna relacja"
            onClick={onNext}
            className="absolute inset-y-24 right-0 z-20 flex w-1/3 items-center justify-end text-white sm:inset-y-auto sm:right-3 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2 sm:justify-center sm:rounded-full sm:bg-black/35"
          >
            <ChevronRight className="hidden h-5 w-5 sm:block" />
          </button>
        )}

        {text && (
          <div className="absolute inset-x-5 bottom-[calc(2rem+env(safe-area-inset-bottom))] z-20">
            <p className="story-viewer-text mx-auto max-w-[18rem] whitespace-pre-wrap text-center text-2xl font-black leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
              {text}
            </p>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

interface StoryCoverImageProps {
  story: SocialStory;
}

function StoryCoverImage({ story }: StoryCoverImageProps) {
  const parsed = parseSocialContent(story.content);

  if (parsed.imagePath) {
    return (
      <img
        src={getSocialImageUrl(parsed.imagePath)}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <StoryImage
      username={story.username}
      avatarUrl={story.avatar_url ?? null}
      className="h-full w-full"
    />
  );
}

interface StoryImageProps {
  username: string;
  avatarUrl: string | null;
  className?: string;
}

function StoryImage({ username, avatarUrl, className }: StoryImageProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const fallback = username.charAt(0).toUpperCase();
  const hasAvatar = Boolean(avatarUrl) && !avatarFailed;

  if (hasAvatar) {
    return (
      <img
        src={avatarUrl ?? undefined}
        alt=""
        className={cn('object-cover', className)}
        loading="lazy"
        onError={() => setAvatarFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex items-center justify-center bg-gradient-to-br from-primary via-red-700 to-neutral-950 text-2xl font-black text-white',
        className,
      )}
    >
      {fallback}
    </span>
  );
}
