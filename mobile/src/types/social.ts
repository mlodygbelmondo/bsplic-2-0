/** Shared social types used by the RPC contract (ported from the web's social feature). */

export const REACTION_EMOJIS = {
  like: '👍',
  heart: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😡',
  fire: '🔥',
} as const;

export type ReactionType = keyof typeof REACTION_EMOJIS;

export const REACTION_LABELS: Record<ReactionType, string> = {
  like: 'Lubię to',
  heart: 'Super',
  laugh: 'Haha',
  wow: 'Wow',
  sad: 'Przykro mi',
  angry: 'Wściekły',
  fire: 'Ogień',
};

export const REACTION_TYPES: ReactionType[] = ['like', 'heart', 'laugh', 'wow', 'sad', 'angry', 'fire'];

export interface MentionUser {
  id: string;
  username: string;
}

export interface ReactorUser {
  user_id: string;
  username: string;
  emoji: ReactionType;
  created_at: string;
}

export interface EniuBotRun {
  id: string;
  sourceType: string;
  sourceId: string;
  status: 'pending' | 'success' | 'skipped' | 'error';
  responseCommentId: string | null;
  responsePostId: string | null;
  error: string | null;
  providerDiagnostic: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
