import { ArrowLeft } from 'lucide-react-native';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { createStyles, useTheme } from '@/theme';
import { Button, Text } from '@/ui';
import { authActions } from './auth-store';
import { AuthField, type AuthFieldProps } from './AuthField';
import { AuthCard, AuthShell } from './AuthShell';
import { normalizeEmail, validateAuthForm, type AuthFieldName, type AuthView } from './validation';

type InputRef = ComponentRef<typeof TextInput>;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'Wystąpił błąd');

/**
 * Web `LoginPage`: login, registration and forgot-password views on the
 * auth shell. A successful sign-in needs no navigation: `Stack.Protected`
 * swaps to the tabs as soon as the session lands.
 */
export function SignInScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState(authActions.readLastEmail);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<InputRef>(null);
  const emailRef = useRef<InputRef>(null);
  const passwordRef = useRef<InputRef>(null);

  const isLogin = view === 'login';

  /** Browser-validation stand-in: toast the problem and focus the field. */
  const isFormValid = () => {
    const invalid = validateAuthForm(view, { email, password, username });
    if (!invalid) return true;
    const refs: Record<AuthFieldName, typeof emailRef> = { username: usernameRef, email: emailRef, password: passwordRef };
    haptics.warning();
    toast.error(invalid.message);
    refs[invalid.field].current?.focus();
    return false;
  };

  const handleSubmit = async () => {
    if (loading || !isFormValid()) return;
    const trimmedEmail = normalizeEmail(email);
    setLoading(true);
    try {
      if (view === 'login') {
        await authActions.signIn(trimmedEmail, password);
        haptics.success();
        toast.success('Zalogowano pomyślnie!');
      } else if (view === 'register') {
        const { requiresEmailConfirmation } = await authActions.signUp(trimmedEmail, password, username);
        haptics.success();
        toast.success(
          requiresEmailConfirmation
            ? 'Konto utworzone! Sprawdź email, aby potwierdzić konto.'
            : 'Konto utworzone i zalogowano automatycznie!',
        );
      }
    } catch (err: unknown) {
      haptics.error();
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (loading || !isFormValid()) return;
    setLoading(true);
    try {
      await authActions.resetPassword(normalizeEmail(email));
      haptics.success();
      toast.success('Link do resetowania hasła został wysłany na Twój e-mail!');
    } catch (err: unknown) {
      haptics.error();
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const emailInputProps = {
    label: 'E-mail',
    value: email,
    onChangeText: setEmail,
    placeholder: 'twoj@email.pl',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    autoComplete: 'email',
    textContentType: 'username',
  } satisfies Partial<AuthFieldProps>;

  if (view === 'forgot') {
    return (
      <AuthShell>
        <AuthCard>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setView('login')}
            style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
          >
            <ArrowLeft size={16} color={colors.mutedForeground} />
            <Text color="mutedForeground">Wróć do logowania</Text>
          </Pressable>

          <Text size="xl" weight="700" color="cardForeground" align="center" accessibilityRole="header" style={styles.forgotTitle}>
            Nie pamiętasz hasła?
          </Text>
          <Text color="mutedForeground" align="center" style={styles.forgotDescription}>
            Wpisz swój adres e-mail, a wyślemy Ci link do resetowania hasła.
          </Text>

          <View style={styles.form}>
            <AuthField
              ref={emailRef}
              {...emailInputProps}
              returnKeyType="send"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => void handleForgotPassword()}
            />
            <Button
              variant="gradient"
              size="lg"
              fullWidth
              label={loading ? 'Wysyłanie...' : 'Wyślij link'}
              disabled={loading}
              onPress={() => void handleForgotPassword()}
              style={styles.submit}
            />
          </View>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        <Text size="xl" weight="700" color="cardForeground" align="center" accessibilityRole="header" style={styles.title}>
          {isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
        </Text>

        <View style={styles.form}>
          {!isLogin ? (
            <AuthField
              ref={usernameRef}
              label="Nazwa użytkownika"
              value={username}
              onChangeText={setUsername}
              placeholder="Twój nick"
              autoCorrect={false}
              autoComplete="username-new"
              textContentType="nickname"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          ) : null}

          <AuthField
            ref={emailRef}
            {...emailInputProps}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <AuthField
            ref={passwordRef}
            label="Hasło"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            textContentType={isLogin ? 'password' : 'newPassword'}
            returnKeyType="go"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={() => void handleSubmit()}
            passwordToggle={{ visible: showPassword, onToggle: () => setShowPassword((value) => !value) }}
          />

          <Button
            variant="gradient"
            size="lg"
            fullWidth
            label={loading ? 'Ładowanie...' : isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
            disabled={loading}
            onPress={() => void handleSubmit()}
            style={styles.submit}
          />
        </View>

        {isLogin ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setView('forgot')}
            style={({ pressed }) => [styles.forgotLink, pressed && styles.pressed]}
          >
            <Text weight="600" color="primary" align="center">
              Nie pamiętasz hasła?
            </Text>
          </Pressable>
        ) : null}
      </AuthCard>

      <View style={styles.footer}>
        <Text align="center" style={styles.footerPrompt}>
          {isLogin ? 'Chcesz otworzyć nowe konto?' : 'Masz już konto?'}
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setView(isLogin ? 'register' : 'login')}
          style={({ pressed }) => [styles.footerAction, pressed && styles.pressed]}
        >
          <Text weight="700" color="primaryForeground">
            {isLogin ? 'Zarejestruj się' : 'Zaloguj się'}
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const useStyles = createStyles(() => ({
  title: { marginBottom: 20 },
  form: { gap: 12 },
  // `h-11 rounded-xl`; the web submit is a plain button, so it does not dim while loading.
  submit: { borderRadius: 12, opacity: 1 },
  forgotLink: { marginTop: 16, alignSelf: 'stretch' },
  footer: { marginTop: 20, alignItems: 'center' },
  footerPrompt: { color: 'rgba(255, 255, 255, 0.7)' },
  footerAction: { marginTop: 4 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 16 },
  forgotTitle: { marginBottom: 8 },
  forgotDescription: { marginBottom: 20 },
  pressed: { opacity: 0.7 },
}));
