import type { SocialStory } from '@/types/database';

/** Each story shows for 7 s (web `STORY_VIEW_MS`). */
export const STORY_VIEW_MS = 7000;

/** Web clock tick that refreshes ages, time-left labels and expiry. */
export const STORY_CLOCK_MS = 30_000;

export function isStoryActive(story: Pick<SocialStory, 'expires_at'>, now: number) {
  return new Date(story.expires_at).getTime() > now;
}

/** Stories not yet expired, in the RPC order. */
export function getActiveStories(stories: SocialStory[], now: number): SocialStory[] {
  return stories.filter((story) => isStoryActive(story, now));
}

/** `teraz` / `${m} min` / `${h} godz.` (web `formatStoryAge`). */
export function formatStoryAge(createdAt: string, now: number = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return 'teraz';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} godz.`;
}

/** `znika za chwilę` / `znika za ${m} min` / `znika za ${h} godz.` (web `formatStoryTimeLeft`). */
export function formatStoryTimeLeft(expiresAt: string, now: number = Date.now()) {
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 60000));
  if (minutes <= 1) return 'znika za chwilę';
  if (minutes < 60) return `znika za ${minutes} min`;
  return `znika za ${Math.ceil(minutes / 60)} godz.`;
}

/**
 * Viewer start index: the tapped story by id (the list may have changed since
 * the tap), else the tapped position clamped to the list.
 */
export function resolveStoryIndex(stories: Pick<SocialStory, 'id'>[], id: string | undefined, index: number) {
  const byId = id ? stories.findIndex((story) => story.id === id) : -1;
  if (byId >= 0) return byId;
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(0, Math.trunc(index)), Math.max(0, stories.length - 1));
}
