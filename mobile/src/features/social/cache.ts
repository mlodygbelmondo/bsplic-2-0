import 'expo-sqlite/localStorage/install';

import type { SocialFeedItem, SocialStory } from '@/types/database';

const FEED_CACHE_KEY = 'bsplic.social.feed.v1';
const STORY_CACHE_KEY = 'bsplic.social.stories.v1';
const DRAFT_PREFIX = 'bsplic.social.draft.v1.';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export const readCachedFeed = () => readJson<SocialFeedItem[]>(FEED_CACHE_KEY, []);
export const readCachedStories = () => readJson<SocialStory[]>(STORY_CACHE_KEY, []);
const socialDraftKey = (userId: string, scope: string) => `${DRAFT_PREFIX}${userId}.${scope}`;

export const readSocialDraft = (userId: string | undefined, scope: string) =>
  userId ? readJson<string>(socialDraftKey(userId, scope), '') : '';

export function cacheSocialFeed(items: SocialFeedItem[]) {
  try { localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(items.slice(0, 100))); } catch { /* memory state remains available */ }
}

export function cacheSocialStories(items: SocialStory[]) {
  try { localStorage.setItem(STORY_CACHE_KEY, JSON.stringify(items)); } catch { /* memory state remains available */ }
}

export function saveSocialDraft(userId: string | undefined, scope: string, value: string) {
  if (!userId) return;
  const key = socialDraftKey(userId, scope);
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  } catch { /* drafts remain available in component state */ }
}
