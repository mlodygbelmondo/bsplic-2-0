import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types/database';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isModerator: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    username: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_BOOTSTRAP_TIMEOUT_MS = 6000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const profileRequestIdRef = useRef(0);
  const inFlightProfileFetchesRef = useRef<Record<string, Promise<void>>>({});

  const clearProfileState = useCallback(() => {
    profileRequestIdRef.current += 1;
    inFlightProfileFetchesRef.current = {};
    setProfile(null);
    setIsAdmin(false);
    setIsModerator(false);
  }, []);

  const fetchProfile = useCallback((userId: string) => {
    const inFlight = inFlightProfileFetchesRef.current[userId];
    if (inFlight) {
      return inFlight;
    }

    const requestId = profileRequestIdRef.current + 1;
    profileRequestIdRef.current = requestId;

    const load = Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId),
    ])
      .then(([profileResult, rolesResult]) => {
        if (profileRequestIdRef.current !== requestId) {
          return;
        }

        setProfile((profileResult.data as Profile | null) ?? null);
        const roles = rolesResult.data ?? [];
        setIsAdmin(
          roles.some((roleRow: { role: string }) => roleRow.role === 'admin'),
        );
        setIsModerator(
          roles.some(
            (roleRow: { role: string }) => roleRow.role === 'moderator',
          ),
        );
      })
      .catch((error) => {
        console.error('Profile fetch error:', error);
        if (profileRequestIdRef.current === requestId) {
          setProfile(null);
          setIsAdmin(false);
          setIsModerator(false);
        }
      })
      .finally(() => {
        if (inFlightProfileFetchesRef.current[userId] === load) {
          delete inFlightProfileFetchesRef.current[userId];
        }
      });

    inFlightProfileFetchesRef.current[userId] = load;
    return load;
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let isMounted = true;
    let hasAuthSignal = false;

    const applyAuthSession = (nextSession: Session | null) => {
      if (!isMounted) return;

      hasAuthSignal = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setTimeout(() => {
          if (isMounted) {
            void fetchProfile(nextSession.user.id);
          }
        }, 0);
      } else {
        clearProfileState();
      }
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyAuthSession(session);
    });

    const timeoutId = window.setTimeout(() => {
      if (!hasAuthSignal) {
        console.warn(
          'Supabase auth bootstrap timed out; showing logged-out UI.',
        );
        applyAuthSession(null);
      }
    }, AUTH_BOOTSTRAP_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        window.clearTimeout(timeoutId);
        applyAuthSession(session);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        console.error('Supabase auth bootstrap error:', error);
        applyAuthSession(null);
      });

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [clearProfileState, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;

    return {
      requiresEmailConfirmation: !data.session,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearProfileState();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isModerator,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        resetPassword,
        signInWithMagicLink,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
