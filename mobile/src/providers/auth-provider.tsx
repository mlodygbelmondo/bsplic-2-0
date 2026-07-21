import 'expo-sqlite/localStorage/install';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import { subscribeToAuthAppState, supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { Database } from '@/types/supabase';

type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type EditableProfileUpdate = Pick<
  ProfileUpdate,
  'avatar_url' | 'username'
>;

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: EditableProfileUpdate) => Promise<void>;
  updateProfileBalance: (balance: number) => void;
  resetPassword: (email: string) => Promise<void>;
}

const AUTH_BOOTSTRAP_TIMEOUT_MS = 6_000;
const PROFILE_CACHE_PREFIX = 'bsplic.auth.profile.v1.';

interface CachedProfileState {
  profile: Profile;
  roles: string[];
}

function readCachedProfile(userId: string): CachedProfileState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${PROFILE_CACHE_PREFIX}${userId}`) ?? 'null') as CachedProfileState | null;
    return parsed?.profile?.id === userId && Array.isArray(parsed.roles) ? parsed : null;
  } catch { return null; }
}

function cacheProfile(userId: string, profile: Profile, roles: string[]) {
  try { localStorage.setItem(`${PROFILE_CACHE_PREFIX}${userId}`, JSON.stringify({ profile, roles } satisfies CachedProfileState)); } catch { /* keep the current in-memory profile */ }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const asError = (error: unknown, fallback: string): Error =>
  error instanceof Error ? error : new Error(fallback, { cause: error });

const PASSWORD_RESET_WEB_URL = `${env.webUrl}/reset-password`;
const PASSWORD_RESET_SCHEME_URL = 'bsplic://reset-password';
const PASSWORD_RESET_REDIRECT_URL = __DEV__
  ? PASSWORD_RESET_SCHEME_URL
  : PASSWORD_RESET_WEB_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const profileRequestIdRef = useRef(0);
  const inFlightProfileFetchesRef = useRef<
    Record<string, Promise<void> | undefined>
  >({});

  const clearProfileState = useCallback(() => {
    profileRequestIdRef.current += 1;
    inFlightProfileFetchesRef.current = {};
    setProfile(null);
    setIsAdmin(false);
    setIsModerator(false);
  }, []);

  const fetchProfile = useCallback((userId: string): Promise<void> => {
    const inFlight = inFlightProfileFetchesRef.current[userId];
    if (inFlight) return inFlight;

    const requestId = profileRequestIdRef.current + 1;
    profileRequestIdRef.current = requestId;

    const load = Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ])
      .then(([profileResult, rolesResult]) => {
        if (profileResult.error) throw profileResult.error;
        if (rolesResult.error) throw rolesResult.error;
        if (profileRequestIdRef.current !== requestId) return;

        const roles = rolesResult.data.map((row) => row.role);
        setProfile(profileResult.data);
        setIsAdmin(roles.includes('admin'));
        setIsModerator(roles.includes('moderator'));
        cacheProfile(userId, profileResult.data, roles);
        setError(null);
      })
      .catch((profileError: unknown) => {
        const normalizedError = asError(
          profileError,
          'Failed to load the user profile',
        );
        console.error('Profile fetch error:', normalizedError);

        if (profileRequestIdRef.current === requestId) {
          const cached = readCachedProfile(userId);
          setProfile(cached?.profile ?? null);
          setIsAdmin(cached?.roles.includes('admin') ?? false);
          setIsModerator(cached?.roles.includes('moderator') ?? false);
          setError(normalizedError);
        }

        throw normalizedError;
      })
      .finally(() => {
        if (inFlightProfileFetchesRef.current[userId] === load) {
          delete inFlightProfileFetchesRef.current[userId];
        }
      });

    inFlightProfileFetchesRef.current[userId] = load;
    return load;
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (user) await fetchProfile(user.id);
  }, [fetchProfile, user]);

  const updateProfile = useCallback(
    async (updates: EditableProfileUpdate): Promise<void> => {
      if (!user) throw new Error('You must be signed in to update a profile');

      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) throw updateError;
      await fetchProfile(user.id);
    },
    [fetchProfile, user],
  );

  const updateProfileBalance = useCallback((balance: number) => {
    setProfile((currentProfile) =>
      currentProfile ? { ...currentProfile, balance } : currentProfile,
    );
  }, []);

  useEffect(() => subscribeToAuthAppState(), []);

  useEffect(() => {
    let isMounted = true;
    let hasAuthSignal = false;

    const applyAuthSession = (nextSession: Session | null) => {
      if (!isMounted) return;

      hasAuthSignal = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      if (nextSession?.user) {
        // Supabase recommends keeping auth callbacks synchronous. Deferring
        // the profile queries also avoids competing for the auth client's lock.
        setTimeout(() => {
          if (!isMounted) return;
          void fetchProfile(nextSession.user.id).catch(() => {
            // fetchProfile records the actionable error in context.
          });
        }, 0);
      } else {
        clearProfileState();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setError(null);
      applyAuthSession(nextSession);
    });

    const timeoutId = setTimeout(() => {
      if (!hasAuthSignal) {
        const timeoutError = new Error('Authentication startup timed out');
        console.warn(
          'Supabase auth bootstrap timed out; showing logged-out UI.',
        );
        setError(timeoutError);
        applyAuthSession(null);
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        clearTimeout(timeoutId);
        if (sessionError) throw sessionError;
        setError(null);
        applyAuthSession(data.session);
      })
      .catch((bootstrapError: unknown) => {
        clearTimeout(timeoutId);
        const normalizedError = asError(
          bootstrapError,
          'Failed to restore the authentication session',
        );
        console.error('Supabase auth bootstrap error:', normalizedError);
        setError(normalizedError);
        applyAuthSession(null);
      });

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [clearProfileState, fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
    },
    [],
  );

  const signOut = useCallback(async (): Promise<void> => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      const { error: localSignOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (localSignOutError) throw localSignOutError;
    }
    clearProfileState();
  }, [clearProfileState]);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: PASSWORD_RESET_REDIRECT_URL },
    );
    if (resetError) throw resetError;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isAdmin,
      isModerator,
      loading,
      error,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
      updateProfileBalance,
      resetPassword,
    }),
    [
      error,
      isAdmin,
      isModerator,
      loading,
      profile,
      refreshProfile,
      resetPassword,
      session,
      signIn,
      signOut,
      updateProfile,
      updateProfileBalance,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
