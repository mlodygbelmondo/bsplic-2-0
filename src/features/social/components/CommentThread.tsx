import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildCommentTree, type FlatComment, type CommentNode } from '../thread';
import { ReactionBar } from './ReactionBar';
import type { ReactionType, ReactionCounts } from '../reactions';
import { MentionSuggestions } from '@/features/social/components/MentionSuggestions';
import { useMentionAutocomplete } from '@/features/social/hooks/useMentionAutocomplete';
import { applyMention } from '@/features/social/mentions';
import { compressImageFile } from '@/features/social/images';
import { SocialImagePreview } from '@/features/social/components/SocialImagePreview';
import { toast } from 'sonner';
import { SocialContentBlock } from '@/features/social/components/SocialContentBlock';

interface AttachedImage {
  blob: Blob;
  previewUrl: string;
  sizeKb: number;
}

function getPastedImageFile(event: React.ClipboardEvent<HTMLInputElement>): File | null {
  const directFile = event.clipboardData.files?.[0];
  if (directFile && directFile.type.startsWith('image/')) {
    return directFile;
  }

  const item = Array.from(event.clipboardData.items ?? []).find((entry) =>
    entry.type.startsWith('image/'),
  );

  return item?.getAsFile() ?? null;
}

interface CommentThreadProps {
  comments: FlatComment[];
  initialCount?: number;
  commentsLoaded?: boolean;
  onFirstExpand?: () => void;
  onAddComment: (content: string, parentId?: string, imageBlob?: Blob) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: ReactionType) => void;
  disabled?: boolean;
  maxDepth?: number;
  currentUserId?: string;
}

export function CommentThread({
  comments,
  initialCount = 0,
  commentsLoaded = true,
  onFirstExpand,
  onAddComment,
  onToggleReaction,
  disabled,
  maxDepth = 3,
  currentUserId,
}: CommentThreadProps) {
  const tree = buildCommentTree(comments);
  const [collapsed, setCollapsed] = useState(true);
  const [showInput, setShowInput] = useState(false);

  const totalCount = commentsLoaded ? comments.length : Math.max(comments.length, initialCount);

  return (
    <div className="space-y-2">
      {/* Toggle comments button */}
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => {
          const willExpand = collapsed;
          setCollapsed(!collapsed);
          if (willExpand) {
            setShowInput(true);
            if (!commentsLoaded) {
              onFirstExpand?.();
            }
          }
        }}
        aria-label={collapsed ? `Pokaż komentarze (${totalCount})` : 'Ukryj komentarze'}
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span>
          {totalCount > 0 ? `${totalCount} ${formatCommentCount(totalCount)}` : 'Skomentuj'}
        </span>
        {totalCount > 0 && (
          collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-2 pl-1">
          {/* Comment list */}
          {tree.map((node) => (
              <CommentNodeView
                key={node.id}
                node={node}
                depth={0}
                maxDepth={maxDepth}
                onAddComment={onAddComment}
                onToggleReaction={onToggleReaction}
                disabled={disabled}
                currentUserId={currentUserId}
              />
            ))}

          {/* Root-level comment input */}
          {showInput && (
              <CommentInput
                onSubmit={(content, imageBlob) => onAddComment(content, undefined, imageBlob)}
                disabled={disabled}
                placeholder="Napisz komentarz..."
                currentUserId={currentUserId}
              />
            )}

          {!showInput && (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => setShowInput(true)}
            >
              Dodaj komentarz
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Comment node (recursive) ─────────────────────────────────

interface CommentNodeViewProps {
  node: CommentNode;
  depth: number;
  maxDepth: number;
  onAddComment: (content: string, parentId?: string, imageBlob?: Blob) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: ReactionType) => void;
  disabled?: boolean;
  currentUserId?: string;
}

function CommentNodeView({
  node,
  depth,
  maxDepth,
  onAddComment,
  onToggleReaction,
  disabled,
  currentUserId,
}: CommentNodeViewProps) {
  const [replying, setReplying] = useState(false);
  const canReply = depth < maxDepth;

  const handleReply = async (content: string, imageBlob?: Blob) => {
    await onAddComment(content, node.id, imageBlob);
    setReplying(false);
  };

  return (
    <div className={cn('space-y-1', depth > 0 && 'ml-4 border-l border-border pl-3')}>
      <div className="flex items-start gap-2">
        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
          {node.username.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold">{node.username}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatTimeAgo(node.created_at)}
            </span>
          </div>
          <div className="mt-0.5">
            <SocialContentBlock
              content={node.image_path ? `${node.content}\n[[img:${node.image_path}]]` : node.content}
              imageAlt="Zdjęcie w komentarzu"
            />
          </div>

          <div className="flex items-center gap-3 mt-1">
            <ReactionBar
              reactions={node.reactions as ReactionCounts | null}
              myReaction={node.my_reaction as ReactionType | null}
              onToggle={(emoji) => onToggleReaction(node.id, emoji)}
              disabled={disabled}
            />
            {canReply && (
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setReplying(!replying)}
                aria-label={`Odpowiedz na komentarz ${node.username}`}
              >
                Odpowiedz
              </button>
            )}
          </div>

          {replying && (
            <div className="mt-2">
              <CommentInput
                onSubmit={handleReply}
                disabled={disabled}
                placeholder={`Odpowiedz @${node.username}...`}
                onCancel={() => setReplying(false)}
                currentUserId={currentUserId}
              />
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {node.children.map((child) => (
        <CommentNodeView
          key={child.id}
          node={child}
          depth={depth + 1}
          maxDepth={maxDepth}
          onAddComment={onAddComment}
          onToggleReaction={onToggleReaction}
          disabled={disabled}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}

// ── Comment input ────────────────────────────────────────────

interface CommentInputProps {
  onSubmit: (content: string, imageBlob?: Blob) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  onCancel?: () => void;
  currentUserId?: string;
}

function CommentInput({ onSubmit, disabled, placeholder, onCancel, currentUserId }: CommentInputProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [caretPosition, setCaretPosition] = useState(0);
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { activeMention, suggestions, loading } = useMentionAutocomplete({
    value: content,
    caretPosition,
    currentUserId,
  });

  const trimmed = content.trim();

  useEffect(() => {
    return () => {
      if (attachedImage) {
        URL.revokeObjectURL(attachedImage.previewUrl);
      }
    };
  }, [attachedImage]);

  const handleSubmit = async () => {
    if ((!trimmed && !attachedImage) || submitting) return;
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

  const handlePaste = async (event: React.ClipboardEvent<HTMLInputElement>) => {
    const file = getPastedImageFile(event);
    if (!file) return;

    event.preventDefault();

    if (attachedImage) {
      toast.error('Możesz dodać maksymalnie jedno zdjęcie do komentarza');
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
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(next.caret, next.caret);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent border border-border rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={placeholder ?? 'Napisz komentarz...'}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setCaretPosition(e.target.selectionStart ?? e.target.value.length);
          }}
          onPaste={(e) => {
            void handlePaste(e);
          }}
          onSelect={(e) => {
            const target = e.target as HTMLInputElement;
            setCaretPosition(target.selectionStart ?? target.value.length);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          disabled={submitting || disabled}
          maxLength={500}
          aria-label={placeholder ?? 'Napisz komentarz...'}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={handleSubmit}
          disabled={(!trimmed && !attachedImage) || submitting || disabled}
          aria-label="Wyślij komentarz"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
        {onCancel && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onCancel}
            aria-label="Anuluj odpowiedź"
          >
            <span className="text-xs">✕</span>
          </Button>
        )}
      </div>
      {attachedImage && (
        <SocialImagePreview
          imageUrl={attachedImage.previewUrl}
          imageKb={attachedImage.sizeKb}
          onRemove={handleRemoveImage}
        />
      )}
      {activeMention && (
        <MentionSuggestions
          loading={loading}
          users={suggestions}
          onSelect={handleMentionSelect}
        />
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function formatCommentCount(count: number): string {
  if (count === 1) return 'komentarz';
  const lastTwo = count % 100;
  if (lastTwo >= 12 && lastTwo <= 14) return 'komentarzy';
  const lastDigit = count % 10;
  if (lastDigit >= 2 && lastDigit <= 4) return 'komentarze';
  return 'komentarzy';
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'teraz';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dn.`;
  return new Date(dateStr).toLocaleDateString('pl-PL');
}
