import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { Eye, EyeOff } from 'lucide-react-native';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppCard, AppInput } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';
import { supabase } from '@/integrations/supabase/client';

type RecoveryState = 'checking' | 'invalid' | 'valid';

export function ResetPasswordScreen() {
  const incomingUrl = Linking.useURL();
  const { tokens } = useAppTheme();
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    const initializeRecovery = async () => {
      if (!incomingUrl) { if (active) setRecoveryState('invalid'); return; }
      try {
        const parsed = new URL(incomingUrl);
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const search = parsed.searchParams;
        const accessToken = search.get('access_token') ?? hash.get('access_token');
        const refreshToken = search.get('refresh_token') ?? hash.get('refresh_token');
        const code = search.get('code');
        const isRecovery = (search.get('type') ?? hash.get('type')) === 'recovery';

        if (accessToken && refreshToken && isRecovery) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
          if (active) setRecoveryState('valid');
          return;
        }
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (active) setRecoveryState('valid');
          return;
        }
        if (active) setRecoveryState('invalid');
      } catch {
        if (active) setRecoveryState('invalid');
      }
    };
    void initializeRecovery();
    return () => { active = false; };
  }, [incomingUrl]);

  const save = async () => {
    if (password.length < 6) { setError('Hasło musi mieć co najmniej 6 znaków.'); return; }
    if (password !== confirm) { setError('Hasła nie są takie same.'); return; }
    setLoading(true); setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.toLocaleLowerCase('en-US') : '';
      setError(message.includes('session') || message.includes('token')
        ? 'Link wygasł lub został już użyty. Wyślij nowy link resetowania.'
        : 'Nie udało się zmienić hasła. Spróbuj ponownie.');
    } finally { setLoading(false); }
  };

  const authBackground = tokens.dark ? '#080004' : '#D71920';
  const authCard = tokens.dark ? '#16040B' : '#FFFFFF';
  const authForeground = tokens.dark ? '#FFF6F7' : '#20232A';
  const authMuted = tokens.dark ? '#CFAEB8' : '#737780';
  const authInput = tokens.dark ? '#280A14' : '#F0F1F3';
  const passwordsMatch = confirm.length > 0 && password === confirm;

  return <View style={{ flex: 1, backgroundColor: authBackground }}>
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }} keyboardShouldPersistTaps="handled">
          {recoveryState === 'valid' && <Text style={{ color: '#fff', fontSize: 36, lineHeight: 43, fontWeight: '900', letterSpacing: -1.2, textAlign: 'center', marginBottom: 30 }}>BSPLIC 2.0</Text>}
          <AppCard style={{ gap: 14, padding: 24, borderRadius: 17, backgroundColor: authCard, borderColor: tokens.dark ? '#3A1420' : '#FFFFFF' }}>
            {recoveryState === 'checking' ? <Text style={{ color: authMuted, textAlign: 'center' }}>Sprawdzanie linku…</Text> : recoveryState === 'invalid' ? <>
              <Text style={{ color: authForeground, fontSize: 21, lineHeight: 27, fontWeight: '800', textAlign: 'center' }}>Nieprawidłowy link</Text>
              <Text style={{ color: authMuted, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>Wróć do logowania i wyślij nowy link resetowania.</Text>
              <AppButton onPress={() => router.replace('/')}>Otwórz logowanie</AppButton>
            </> : done ? <>
              <Text style={{ color: authForeground, fontSize: 21, fontWeight: '800', textAlign: 'center' }}>Hasło zostało zmienione</Text>
              <Text style={{ color: '#198754', textAlign: 'center' }}>Możesz bezpiecznie wrócić do aplikacji.</Text>
              <AppButton onPress={() => router.replace('/')}>Przejdź do aplikacji</AppButton>
            </> : <>
              <View style={{ gap: 7, marginBottom: 4 }}>
                <Text style={{ color: authForeground, fontSize: 21, lineHeight: 27, fontWeight: '800', textAlign: 'center' }}>Ustaw nowe hasło</Text>
                <Text style={{ color: authMuted, textAlign: 'center', fontSize: 14 }}>Wpisz nowe hasło do swojego konta.</Text>
              </View>
              <AppInput label="Nowe hasło" placeholder="••••••••" secureTextEntry={!passwordVisible} textContentType="newPassword" value={password} onChangeText={setPassword} rightAccessory={<Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Ukryj hasło' : 'Pokaż hasło'} onPress={() => setPasswordVisible(value => !value)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>{passwordVisible ? <EyeOff color={authMuted} size={20} /> : <Eye color={authMuted} size={20} />}</Pressable>} style={{ minHeight: 60, backgroundColor: authInput, borderColor: authInput }} />
              <AppInput label="Potwierdź hasło" placeholder="••••••••" secureTextEntry={!passwordVisible} textContentType="newPassword" value={confirm} onChangeText={setConfirm} onSubmitEditing={() => void save()} returnKeyType="done" style={{ minHeight: 60, backgroundColor: authInput, borderColor: authInput }} />
              {confirm.length > 0 && <Text style={{ color: passwordsMatch ? '#198754' : '#d91f42', fontSize: 13, fontWeight: '600' }}>{passwordsMatch ? 'Hasła są zgodne' : 'Hasła nie są takie same'}</Text>}
              {error && <Text selectable style={{ color: '#d91f42', fontSize: 13, textAlign: 'center' }}>{error}</Text>}
              <AppButton loading={loading} disabled={loading || password.length < 6 || !passwordsMatch} onPress={() => void save()}>Zmień hasło</AppButton>
            </>}
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}
