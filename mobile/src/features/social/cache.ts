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
export const readSocialDraft = (scope: string) => readJson<string>(`${DRAFT_PREFIX}${scope}`, '');

export function cacheSocialFeed(items: SocialFeedItem[]) {
  try { localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(items.slice(0, 100))); } catch { /* memory state remains available */ }
}

export function cacheSocialStories(items: SocialStory[]) {
  try { localStorage.setItem(STORY_CACHE_KEY, JSON.stringify(items)); } catch { /* memory state remains available */ }
}

export function saveSocialDraft(scope: string, value: string) {
  try {
    if (value) localStorage.setItem(`${DRAFT_PREFIX}${scope}`, JSON.stringify(value));
    else localStorage.removeItem(`${DRAFT_PREFIX}${scope}`);
  } catch { /* drafts remain available in component state */ }
}
