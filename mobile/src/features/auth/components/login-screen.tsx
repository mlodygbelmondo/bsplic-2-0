/* eslint-disable @typescript-eslint/no-require-imports -- Metro resolves bundled image assets through static require calls. */
import { useEffect, useState } from 'react';
import AsyncStorage from 'expo-sqlite/kv-store';
import { ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { AppButton, AppCard, AppInput } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/hooks/use-app-theme';

const LAST_EMAIL_KEY = 'bsplic.auth.last-email';

export function LoginScreen() {
  const { signIn, resetPassword } = useAuth();
  const { tokens } = useAppTheme();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void AsyncStorage.getItem(LAST_EMAIL_KEY).then(value => value && setEmail(value)); }, []);

  const submit = async () => {
    setLoading(true); setError(null); setMessage(null);
    try {
      if (forgot) {
        if (!email.trim()) throw new Error('Wpisz swój adres e-mail');
        await resetPassword(email);
        setMessage('Link do resetowania hasła został wysłany na Twój e-mail.');
      } else {
        if (!email.trim() || password.length < 6) throw new Error('Podaj e-mail i hasło (minimum 6 znaków).');
        await signIn(email, password);
        await AsyncStorage.setItem(LAST_EMAIL_KEY, email.trim());
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Wystąpił błąd'); }
    finally { setLoading(false); }
  };

  return <ImageBackground source={require('../../../../assets/images/icon.png')} blurRadius={80} style={{ flex: 1, backgroundColor: '#960020' }} imageStyle={{ opacity: 0.22 }}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 28 }}><Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', fontStyle: 'italic', letterSpacing: -1.4 }}>BSPLIC 2.0</Text></View>
        <AppCard style={{ gap: 16, padding: 22 }}>
          <View style={{ gap: 7 }}><Text style={{ fontSize: 23, fontWeight: '900', color: tokens.colors.foreground, textAlign: 'center' }}>{forgot ? 'Nie pamiętasz hasła?' : 'Zaloguj się'}</Text>{forgot && <Text style={{ color: tokens.colors.mutedForeground, textAlign: 'center', fontSize: 13 }}>Wpisz e-mail, a wyślemy Ci bezpieczny link do ustawienia nowego hasła.</Text>}</View>
          <AppInput label="E-mail" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" value={email} onChangeText={setEmail} returnKeyType={forgot ? 'done' : 'next'} />
          {!forgot && <AppInput label="Hasło" secureTextEntry textContentType="password" autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} returnKeyType="done" />}
          {error && <Text selectable style={{ color: '#d91f42', fontSize: 13, textAlign: 'center' }}>{error}</Text>}
          {message && <Text selectable style={{ color: '#198754', fontSize: 13, textAlign: 'center' }}>{message}</Text>}
          <AppButton loading={loading} onPress={() => void submit()} fullWidth>{forgot ? 'Wyślij link' : 'Zaloguj się'}</AppButton>
          <Pressable accessibilityRole="button" onPress={() => { setForgot(value => !value); setError(null); setMessage(null); }} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: tokens.colors.primary, fontWeight: '800' }}>{forgot ? 'Wróć do logowania' : 'Nie pamiętam hasła'}</Text></Pressable>
        </AppCard>
      </ScrollView>
    </KeyboardAvoidingView>
  </ImageBackground>;
}
