import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { AppButton, AppCard, AppInput } from '@/components/ui';
import { supabase } from '@/integrations/supabase/client';

export function ResetPasswordScreen() {
  const incomingUrl = Linking.useURL();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!incomingUrl) return;
    const parsed = new URL(incomingUrl);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const accessToken = parsed.searchParams.get('access_token') ?? hash.get('access_token');
    const refreshToken = parsed.searchParams.get('refresh_token') ?? hash.get('refresh_token');
    if (accessToken && refreshToken) {
      void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error: sessionError }) => {
        if (sessionError) setError(sessionError.message);
      });
    }
  }, [incomingUrl]);
  const save = async () => {
    if (password.length < 6) { setError('Hasło musi mieć minimum 6 znaków.'); return; }
    if (password !== confirm) { setError('Hasła nie są identyczne.'); return; }
    setLoading(true); setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    setDone(true);
  };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#090005', justifyContent: 'center', padding: 20 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <AppCard style={{ gap: 16 }}><Text style={{ color: '#fff2f5', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>Ustaw nowe hasło</Text>{done ? <View style={{ gap: 16 }}><Text style={{ color: '#36c987', textAlign: 'center' }}>Hasło zostało zmienione.</Text><AppButton onPress={() => router.replace('/')}>Przejdź do aplikacji</AppButton></View> : <><AppInput label="Nowe hasło" secureTextEntry value={password} onChangeText={setPassword} /><AppInput label="Powtórz hasło" secureTextEntry value={confirm} onChangeText={setConfirm} onSubmitEditing={() => void save()} />{error && <Text style={{ color: '#f55b68', textAlign: 'center' }}>{error}</Text>}<AppButton loading={loading} onPress={() => void save()}>Zapisz hasło</AppButton></>}</AppCard>
  </KeyboardAvoidingView>;
}
