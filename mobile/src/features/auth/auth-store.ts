import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

import { queryClient, queryPersister } from '@/lib/query-client';
import { readJson, writeJson, kv, secureKv } from '@/lib/storage';
import { AUTH_STORAGE_KEY, supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import type { Profile } from '@/types/database';

/**
 * Auth state (port of the web's AuthContext) as a zustand store, so screens
 * subscribe to exactly the slice they render: a balance change re-renders the
 * balance chip, not every consumer of auth.
 */

type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

interface CachedIdentity {
  userId: string;
  profile: Profile;
  isAdmin: boolean;
  isModerator: boolean;
}

interface AuthState {
  /** True until the first auth signal (stored session read or auth event). */
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  isAdmin: boolean;
  isModerator: boolean;
}

const IDENTITY_CACHE_KEY = 'bsplic.auth.identity';
const LAST_EMAIL_KEY = 'bsplic.auth.last-email';
const AUTH_BOOTSTRAP_TIMEOUT_MS = 6000;

export const useAuthStore = create<AuthState>(() => ({
  loading: true,
  session: null,
  user: null,
  profile: null,
  profileStatus: 'idle',
  isAdmin: false,
  isModerator: false,
}));

let profileRequestId = 0;
const inFlightProfileFetches = new Map<string, Promise<void>>();

function persistIdentity() {
  const { user, profile, isAdmin, isModerator } = useAuthStore.getState();
  if (user && profile) {
    writeJson(IDENTITY_CACHE_KEY, { userId: user.id, profile, isAdmin, isModerator } satisfies CachedIdentity);
  }
}

function clearProfileState() {
  profileRequestId += 1;
  inFlightProfileFetches.clear();
  kv.remove(IDENTITY_CACHE_KEY);
  useAuthStore.setState({ profile: null, profileStatus: 'idle', isAdmin: false, isModerator: false });
}

// `fresh` skips a request already in flight: after a write (bet, top-up) that
// older request would answer with the pre-write balance.
function fetchProfile(userId: string, fresh = false): Promise<void> {
  const inFlight = inFlightProfileFetches.get(userId);
  if (inFlight && !fresh) return inFlight;

  const requestId = ++profileRequestId;
  if (!useAuthStore.getState().profile) {
    useAuthStore.setState({ profileStatus: 'loading' });
  }

  const load = Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ])
    .then(([profileResult, rolesResult]) => {
      if (profileRequestId !== requestId) return;
      if (profileResult.error || !profileResult.data) {
        throw profileResult.error ?? new Error('Profile not found');
      }
      const roles = rolesResult.data ?? [];
      const previous = useAuthStore.getState().profile;
      const next = profileResult.data as Profile;
      useAuthStore.setState({
        // An unchanged row keeps its object, so profile subscribers skip the re-render.
        profile: previous && shallow(previous, next) ? previous : next,
        profileStatus: 'ready',
        isAdmin: roles.some((row) => row.role === 'admin'),
        isModerator: roles.some((row) => row.role === 'moderator'),
      });
      persistIdentity();
    })
    .catch((error: unknown) => {
      console.warn('Profile fetch error:', error);
      if (profileRequestId !== requestId) return;
      // Keep a cached profile on screen (offline cold start); only surface an
      // error when there is nothing to show.
      if (!useAuthStore.getState().profile) {
        useAuthStore.setState({ profileStatus: 'error' });
      }
    })
    .finally(() => {
      if (inFlightProfileFetches.get(userId) === load) {
        inFlightProfileFetches.delete(userId);
      }
    });

  inFlightProfileFetches.set(userId, load);
  return load;
}

/** Drops cached data from memory and disk at once (the persister's own save is throttled). */
function clearQueryCache() {
  queryClient.clear();
  void queryPersister.removeClient();
}

function applyAuthSession(session: Session | null, { fromTimeout = false } = {}) {
  const previousUserId = useAuthStore.getState().user?.id;
  const nextUser = session?.user ?? null;

  if (nextUser) {
    const patch: Partial<AuthState> = { session, user: nextUser, loading: false };
    // Another account took over without a sign-out (a recovery link): drop the previous user's data.
    if (previousUserId && previousUserId !== nextUser.id) clearQueryCache();
    if (previousUserId !== nextUser.id) {
      // Seed from the identity cache so a signed-in cold start renders the
      // first screen immediately instead of waiting for the profile query.
      const cached = readJson<CachedIdentity>(IDENTITY_CACHE_KEY);
      if (cached?.userId === nextUser.id) {
        Object.assign(patch, {
          profile: cached.profile,
          profileStatus: 'ready',
          isAdmin: cached.isAdmin,
          isModerator: cached.isModerator,
        });
      } else {
        Object.assign(patch, { profile: null, profileStatus: 'loading', isAdmin: false, isModerator: false });
      }
    }
    useAuthStore.setState(patch);
    void fetchProfile(nextUser.id);
  } else {
    // No session (signed out, or the stored one was revoked or expired): whoever
    // owned the restored cache is gone. A slow-start timeout keeps it, since the
    // session may still arrive.
    if (previousUserId || !fromTimeout) clearQueryCache();
    clearProfileState();
    useAuthStore.setState({ session: null, user: null, loading: false });
  }
}

/** The session supabase-js stored last run, read synchronously (it may be expired). */
function readStoredSession(): Session | null {
  try {
    const raw = secureKv.getString(AUTH_STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as Partial<Session>) : null;
    return session?.access_token && session.refresh_token && session.user?.id ? (session as Session) : null;
  } catch {
    return null;
  }
}

let started = false;

/** Starts listening to Supabase auth. Called once from the root layout. */
export function startAuth() {
  if (started) return;
  started = true;
  let hasAuthSignal = false;

  // Signed-in cold start: render at once from the stored session and the cached
  // identity instead of waiting for a token refresh. supabase-js refreshes in
  // the background and every request waits for it; a revoked session still
  // ends in SIGNED_OUT.
  const stored = readStoredSession();
  if (stored && readJson<CachedIdentity>(IDENTITY_CACHE_KEY)?.userId === stored.user.id) {
    hasAuthSignal = true;
    applyAuthSession(stored);
  }

  supabase.auth.onAuthStateChange((event, session) => {
    hasAuthSignal = true;
    // INITIAL_SESSION is null when the stored token could not be refreshed yet
    // (offline); supabase-js keeps it and retries. A real sign-out is SIGNED_OUT.
    if (event === 'INITIAL_SESSION' && !session && useAuthStore.getState().user) return;
    // Defer out of the auth callback (supabase-js deadlocks if another auth
    // call runs inside it).
    setTimeout(() => applyAuthSession(session), 0);
  });

  const timeoutId = setTimeout(() => {
    if (!hasAuthSignal) {
      console.warn('Supabase auth bootstrap timed out; showing logged-out UI.');
      applyAuthSession(null, { fromTimeout: true });
    }
  }, AUTH_BOOTSTRAP_TIMEOUT_MS);

  supabase.auth
    .getSession()
    .then(({ data: { session }, error }) => {
      clearTimeout(timeoutId);
      hasAuthSignal = true;
      // Offline with an expired token: stay on the stored session until a refresh succeeds.
      if (!session && error && isAuthRetryableFetchError(error) && useAuthStore.getState().user) return;
      applyAuthSession(session);
    })
    .catch((error: unknown) => {
      clearTimeout(timeoutId);
      console.warn('Supabase auth bootstrap error:', error);
      applyAuthSession(null);
    });
}

export const authActions = {
  async signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    kv.set(LAST_EMAIL_KEY, email);
  },

  async signUp(email: string, password: string, username: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    kv.set(LAST_EMAIL_KEY, email);
    return { requiresEmailConfirmation: !data.session };
  },

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Offline with an expired token, supabase-js gives up before removing the
        // stored session, and the next refresh would sign the user back in.
        secureKv.clearAll();
      }
    } finally {
      // The SIGNED_OUT event clears state too; do it eagerly so the UI never
      // shows the previous user's data after a failed network sign-out.
      clearQueryCache();
      clearProfileState();
      useAuthStore.setState({ session: null, user: null });
    }
  },

  async resetPassword(email: string) {
    // Universal link: opens the app when installed, the PWA otherwise.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${env.webUrl}/reset-password`,
    });
    if (error) throw error;
  },

  async refreshProfile() {
    const userId = useAuthStore.getState().user?.id;
    if (userId) await fetchProfile(userId, true);
  },

  updateProfileBalance(balance: number) {
    const { profile } = useAuthStore.getState();
    if (!profile) return;
    // Drop older profile requests so their pre-write balance can't land after this.
    profileRequestId += 1;
    inFlightProfileFetches.clear();
    useAuthStore.setState({ profile: { ...profile, balance } });
    persistIdentity();
  },

  readLastEmail(): string {
    return kv.getString(LAST_EMAIL_KEY) ?? '';
  },
};

// Selectors — prefer these over reading the whole store.
export const useUser = () => useAuthStore((s) => s.user);
export const useUserId = () => useAuthStore((s) => s.user?.id ?? null);
export const useProfile = () => useAuthStore((s) => s.profile);
export const useBalance = () => useAuthStore((s) => s.profile?.balance ?? 0);
export const useIsAdmin = () => useAuthStore((s) => s.isAdmin);
export const useIsModerator = () => useAuthStore((s) => s.isModerator);
