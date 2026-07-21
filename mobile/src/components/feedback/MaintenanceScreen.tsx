import { Text, View } from 'react-native';
import { AppButton } from '@/components/ui';
import { useAppTheme } from '@/hooks/use-app-theme';

export function MaintenanceScreen({ checking, onRetry }: { checking: boolean; onRetry(): void }) {
  const { tokens } = useAppTheme();
  return <View style={{ flex: 1, backgroundColor: tokens.colors.background, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}><Text style={{ fontSize: 52 }}>🛠️</Text><Text style={{ color: tokens.colors.foreground, fontSize: 27, fontWeight: '900', textAlign: 'center' }}>Krótka przerwa techniczna</Text><Text style={{ color: tokens.colors.mutedForeground, textAlign: 'center', lineHeight: 21 }}>Pracujemy nad BSPLIC. Twoje konto, kupony i saldo są bezpieczne. Spróbuj ponownie za chwilę.</Text><AppButton loading={checking} onPress={onRetry}>Sprawdź ponownie</AppButton></View>;
}
