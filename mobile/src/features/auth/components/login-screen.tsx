import { useEffect, useState } from 'react';
import AsyncStorage from 'expo-sqlite/kv-store';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const authBackground = tokens.dark ? '#080004' : '#D71920';
  const authCard = tokens.dark ? '#16040B' : '#FFFFFF';
  const authForeground = tokens.dark ? '#FFF6F7' : '#20232A';
  const authMuted = tokens.dark ? '#CFAEB8' : '#737780';
  const authInput = tokens.dark ? '#280A14' : '#F0F1F3';

  return <View style={{ flex: 1, backgroundColor: authBackground }}>
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 30 }}><Text style={{ color: '#fff', fontSize: 36, lineHeight: 43, fontWeight: '900', letterSpacing: -1.2 }}>BSPLIC 2.0</Text></View>
        <AppCard style={{ gap: 13, padding: 24, borderRadius: 17, backgroundColor: authCard, borderColor: tokens.dark ? '#3A1420' : '#FFFFFF' }}>
          <View style={{ gap: 7, marginBottom: 4 }}><Text style={{ fontSize: 21, lineHeight: 27, fontWeight: '800', color: authForeground, textAlign: 'center' }}>{forgot ? 'Nie pamiętasz hasła?' : 'Zaloguj się'}</Text>{forgot && <Text style={{ color: authMuted, textAlign: 'center', fontSize: 13, lineHeight: 18 }}>Wpisz e-mail, a wyślemy Ci bezpieczny link do ustawienia nowego hasła.</Text>}</View>
          <AppInput label="E-mail" placeholder="twoj@email.pl" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" value={email} onChangeText={setEmail} returnKeyType={forgot ? 'done' : 'next'} style={{ minHeight: 60, backgroundColor: authInput, borderColor: authInput }} />
          {!forgot && <AppInput label="Hasło" placeholder="••••••••" secureTextEntry textContentType="password" autoComplete="current-password" value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} returnKeyType="done" style={{ minHeight: 60, backgroundColor: authInput, borderColor: authInput }} />}
          {error && <Text selectable style={{ color: '#d91f42', fontSize: 13, textAlign: 'center' }}>{error}</Text>}
          {message && <Text selectable style={{ color: '#198754', fontSize: 13, textAlign: 'center' }}>{message}</Text>}
          <AppButton loading={loading} onPress={() => void submit()} fullWidth>{forgot ? 'Wyślij link' : 'Zaloguj się'}</AppButton>
          <Pressable accessibilityRole="button" onPress={() => { setForgot(value => !value); setError(null); setMessage(null); }} style={{ minHeight: 38, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: tokens.colors.primary, fontSize: 14, fontWeight: '700' }}>{forgot ? 'Wróć do logowania' : 'Nie pamiętasz hasła?'}</Text></Pressable>
        </AppCard>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}
