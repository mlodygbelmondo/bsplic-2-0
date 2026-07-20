import { Text, View } from 'react-native';
import { AppButton } from '@/components/ui';

export function MaintenanceScreen({ checking, onRetry }: { checking: boolean; onRetry(): void }) {
  return <View style={{ flex: 1, backgroundColor: '#090005', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}><Text style={{ fontSize: 52 }}>🛠️</Text><Text style={{ color: '#fff2f5', fontSize: 27, fontWeight: '900', textAlign: 'center' }}>Krótka przerwa techniczna</Text><Text style={{ color: '#d9a8b6', textAlign: 'center', lineHeight: 21 }}>Pracujemy nad BSPLIC. Twoje konto, kupony i saldo są bezpieczne. Spróbuj ponownie za chwilę.</Text><AppButton loading={checking} onPress={onRetry}>Sprawdź ponownie</AppButton></View>;
}
