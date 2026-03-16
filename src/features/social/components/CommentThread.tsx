import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildCommentTree, type FlatComment, type CommentNode } from '../thread';
import { ReactionBar } from './ReactionBar';
import type { ReactionType, ReactionCounts } from '../reactions';

interface CommentThreadProps {
  comments: FlatComment[];
  initialCount?: number;
  commentsLoaded?: boolean;
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: ReactionType) => void;
  disabled?: boolean;
  maxDepth?: number;
}

export function CommentThread({
  comments,
  initialCount = 0,
  commentsLoaded = true,
  onAddComment,
  onToggleReaction,
  disabled,
  maxDepth = 3,
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
          setCollapsed(!collapsed);
          if (collapsed) setShowInput(true);
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
            />
          ))}

          {/* Root-level comment input */}
          {showInput && (
            <CommentInput
              onSubmit={(content) => onAddComment(content)}
              disabled={disabled}
              placeholder="Napisz komentarz..."
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
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onToggleReaction: (commentId: string, emoji: ReactionType) => void;
  disabled?: boolean;
}

function CommentNodeView({
  node,
  depth,
  maxDepth,
  onAddComment,
  onToggleReaction,
  disabled,
}: CommentNodeViewProps) {
  const [replying, setReplying] = useState(false);
  const canReply = depth < maxDepth;

  const handleReply = async (content: string) => {
    await onAddComment(content, node.id);
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
          <p className="text-sm mt-0.5">{node.content}</p>

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
        />
      ))}
    </div>
  );
}

// ── Comment input ────────────────────────────────────────────

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  onCancel?: () => void;
}

function CommentInput({ onSubmit, disabled, placeholder, onCancel }: CommentInputProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const trimmed = content.trim();

  const handleSubmit = async () => {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        className="flex-1 bg-transparent border border-border rounded-lg px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        placeholder={placeholder ?? 'Napisz komentarz...'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
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
        disabled={!trimmed || submitting || disabled}
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
