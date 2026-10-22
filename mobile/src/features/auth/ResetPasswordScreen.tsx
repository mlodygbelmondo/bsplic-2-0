import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, TextInput, View } from 'react-native';

import { useBootHold } from '@/features/boot/boot-store';
import { haptics } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import { createStyles } from '@/theme';
import { Button, Text } from '@/ui';
import { getErrorMessage } from '@/lib/errors';
import { readStoredUserId, useAuthStore, waitForSignOut } from './auth-store';
import { AuthField } from './AuthField';
import { AuthCard, AuthShell } from './AuthShell';
import { parseRecoveryLink, parseRecoveryUrl, readJwtSubject, recoveryLinkKey, type RecoveryLink } from './recovery-link';
import { MIN_PASSWORD_LENGTH, SHORT_PASSWORD_MESSAGE } from './validation';

type Status = 'checking' | 'recovery' | 'invalid';
type RouteParams = { '#'?: string | string[]; code?: string | string[]; error_description?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
const errorMessage = (err: unknown) => getErrorMessage(err, 'Wystąpił błąd');

/**
 * Expo Router keeps a universal link's fragment as the `#` route param;
 * app-scheme links lose it, so fall back to the raw incoming URL.
 */
function resolveRecoveryLink(
  hash: string | null,
  code: string | null,
  errorDescription: string | null,
  linkingUrl: string | null,
): RecoveryLink {
  const fromRoute = parseRecoveryLink({
    hash,
    query: { code: code ?? undefined, error_description: errorDescription ?? undefined },
  });
  if (fromRoute.kind !== 'none') return fromRoute;
  return parseRecoveryUrl(linkingUrl) ?? fromRoute;
}

const recoveryAttempts = new Map<string, Promise<boolean>>();

/** Exchanges the link for a session once per link (tokens are single use). */
function establishRecoverySession(link: RecoveryLink): Promise<boolean> {
  const key = recoveryLinkKey(link);
  let attempt = recoveryAttempts.get(key);
  if (!attempt) {
    attempt = (async () => {
      // A sign-out still finishing would remove the recovery session right after it is stored.
      await waitForSignOut();
      if (link.kind === 'tokens') {
        // Anyone can craft a link with their own tokens: never let one switch a signed-in player to another account.
        const signedInUserId = readStoredUserId();
        if (signedInUserId && readJwtSubject(link.accessToken) !== signedInUserId) {
          throw new Error('The recovery link belongs to another account');
        }
        const { error } = await supabase.auth.setSession({
          access_token: link.accessToken,
          refresh_token: link.refreshToken,
        });
        if (error) throw error;
        return true;
      }
      if (link.kind === 'code') {
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        if (error) throw error;
        return true;
      }
      return false;
    })().catch((error: unknown) => {
      console.warn('Password recovery link rejected:', error);
      return false;
    });
    recoveryAttempts.set(key, attempt);
  }
  return attempt;
}

/**
 * Web `ResetPasswordPage` (`/reset-password`, public). Supabase sends the
 * recovery link there; the screen turns it into a session, then lets the
 * user set a new password.
 */
export function ResetPasswordScreen() {
  const params = useLocalSearchParams<RouteParams>();
  const linkingUrl = Linking.useLinkingURL();
  const hash = first(params['#']);
  const code = first(params.code);
  const errorDescription = first(params.error_description);
  const link = resolveRecoveryLink(hash, code, errorDescription, linkingUrl);
  const linkKey = recoveryLinkKey(link);
  const needsSession = link.kind === 'tokens' || link.kind === 'code';

  const [resolved, setResolved] = useState<{ key: string; ok: boolean } | null>(null);
  const [recoveryEvent, setRecoveryEvent] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryEvent(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const current = resolveRecoveryLink(hash, code, errorDescription, linkingUrl);
    if (current.kind !== 'tokens' && current.kind !== 'code') return;
    let cancelled = false;
    const key = recoveryLinkKey(current);
    void establishRecoverySession(current).then((ok) => {
      if (!cancelled) setResolved({ key, ok });
    });
    return () => {
      cancelled = true;
    };
  }, [hash, code, errorDescription, linkingUrl]);

  let status: Status;
  if (recoveryEvent) {
    status = 'recovery';
  } else if (needsSession) {
    status = resolved?.key === linkKey ? (resolved.ok ? 'recovery' : 'invalid') : 'checking';
  } else {
    status = 'invalid';
  }

  // A cold start from the link keeps the boot overlay up until the session is set.
  useBootHold(status === 'checking');

  if (status === 'checking') return <CheckingLink />;
  if (status === 'invalid') return <InvalidLink />;
  return <NewPasswordForm />;
}

function CheckingLink() {
  const styles = useStyles();
  return (
    <View style={styles.checking}>
      <ActivityIndicator size="large" color="#ffffff" accessibilityLabel="Ładowanie" />
    </View>
  );
}

function InvalidLink() {
  const styles = useStyles();
  const signedIn = useAuthStore((s) => s.user !== null);
  return (
    <AuthShell background="primary" wordmark={false}>
      <AuthCard>
        <Text size="xl" weight="700" color="cardForeground" align="center" accessibilityRole="header" style={styles.invalidTitle}>
          Nieprawidłowy link
        </Text>
        <Text color="mutedForeground" align="center" style={styles.invalidDescription}>
          Wróć do logowania i wyślij nowy link resetowania.
        </Text>
        <Button
          variant="gradient"
          label="Otwórz logowanie"
          onPress={() => router.replace(signedIn ? '/' : '/sign-in')}
          style={styles.invalidButton}
        />
      </AuthCard>
    </AuthShell>
  );
}

function NewPasswordForm() {
  const styles = useStyles();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const hasConfirmation = confirmPassword.length > 0;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = !loading && password.length >= MIN_PASSWORD_LENGTH && passwordsMatch;

  const handleSubmit = async () => {
    if (loading) return;
    if (password !== confirmPassword) {
      toast.error('Hasła nie są takie same');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(SHORT_PASSWORD_MESSAGE);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      haptics.success();
      toast.success('Hasło zostało zmienione!');
      router.replace('/');
    } catch (err: unknown) {
      haptics.error();
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell background="primary">
      <AuthCard>
        <Text size="xl" weight="700" color="cardForeground" align="center" accessibilityRole="header" style={styles.title}>
          Ustaw nowe hasło
        </Text>
        <Text color="mutedForeground" align="center" style={styles.description}>
          Wpisz nowe hasło do swojego konta.
        </Text>

        <View style={styles.form}>
          <AuthField
            label="Nowe hasło"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
            passwordToggle={{ visible: showPassword, onToggle: () => setShowPassword((value) => !value) }}
          />
          <AuthField
            ref={confirmRef}
            label="Potwierdź hasło"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => {
              if (canSubmit) void handleSubmit();
            }}
          />
          {hasConfirmation ? (
            <Text
              size="xs"
              weight="600"
              color={passwordsMatch ? 'success' : 'destructive'}
              accessibilityLiveRegion="polite"
            >
              {passwordsMatch ? 'Hasła są zgodne' : 'Hasła nie są takie same'}
            </Text>
          ) : null}

          <Button
            variant="gradient"
            size="lg"
            fullWidth
            label={loading ? 'Zapisywanie...' : 'Zmień hasło'}
            disabled={!canSubmit}
            onPress={() => void handleSubmit()}
            style={styles.submit}
          />
        </View>
      </AuthCard>
    </AuthShell>
  );
}

const useStyles = createStyles(({ gradients }) => ({
  checking: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundImage: gradients.primary },
  invalidTitle: { marginBottom: 12 },
  invalidDescription: { marginBottom: 20 },
  // shadcn Button (default size) with `gradient-primary font-bold`, no shadow.
  invalidButton: { alignSelf: 'center', boxShadow: [] },
  title: { marginBottom: 8 },
  description: { marginBottom: 20 },
  form: { gap: 12 },
  submit: { borderRadius: 12 },
}));
