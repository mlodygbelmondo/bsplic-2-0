import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { Alert, Pressable, Text, View } from 'react-native';

import { AppAvatar, AppButton, AppInput, AppModal } from '@/components/ui';
import { fetchUserNotifications, markAllNotificationsRead, markNotificationRead } from '@/features/notifications/api/notifications';
import { createMoneyTransfer, fetchMoneyTransferHistory, searchMoneyTransferRecipients } from '@/features/transfers/api';
import type { MoneyTransferHistoryEntry, MoneyTransferRecipient } from '@/features/transfers/types';
import { useAuth } from '@/providers/auth-provider';
import { useNetwork } from '@/providers/network-provider';
import type { UserNotification } from '@/types/database';

const colors = { foreground: '#fff2f5', muted: '#d9a8b6', card: '#280917', border: '#5b1a2e', primary: '#ff0a54', success: '#36c987' };

export function NotificationsSheet({ visible, onClose, onCountChange, soundMuted, onToggleSound }: { visible: boolean; onClose(): void; onCountChange(count: number): void; soundMuted: boolean; onToggleSound(): void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { const next = await fetchUserNotifications(user.id, 50); setItems(next); onCountChange(next.filter(item => !item.is_read).length); }
    catch (cause) { Alert.alert('Powiadomienia', cause instanceof Error ? cause.message : 'Nie udało się wczytać powiadomień.'); }
    finally { setLoading(false); }
  }, [onCountChange, user]);
  useEffect(() => { if (visible) void load(); }, [load, visible]);
  const open = async (item: UserNotification) => {
    if (user && !item.is_read) { await markNotificationRead(user.id, item.id); setItems(current => current.map(row => row.id === item.id ? { ...row, is_read: true } : row)); onCountChange(Math.max(0, items.filter(row => !row.is_read).length - 1)); }
    onClose(); if (item.link_path) router.push(item.link_path as never);
  };
  return <AppModal visible={visible} title="Powiadomienia" onClose={onClose}><View style={{ gap: 10 }}>
    <AppButton variant="outline" onPress={onToggleSound}>{soundMuted ? 'Włącz dźwięk powiadomień' : 'Wyłącz dźwięk powiadomień'}</AppButton>
    {items.some(item => !item.is_read) && <AppButton variant="ghost" onPress={() => user && void markAllNotificationsRead(user.id).then(() => { setItems(current => current.map(item => ({ ...item, is_read: true }))); onCountChange(0); })}>Oznacz wszystkie jako przeczytane</AppButton>}
    {loading ? <Text style={{ color: colors.muted, textAlign: 'center', padding: 20 }}>Wczytywanie…</Text> : items.length === 0 ? <Text style={{ color: colors.muted, textAlign: 'center', padding: 20 }}>Brak powiadomień</Text> : items.map(item => <Pressable key={item.id} onPress={() => void open(item)} style={{ gap: 4, borderWidth: 1, borderColor: item.is_read ? colors.border : colors.primary, borderRadius: 13, backgroundColor: colors.card, padding: 12 }}><Text style={{ color: colors.foreground, fontWeight: item.is_read ? '700' : '900' }}>{item.title}</Text>{item.body && <Text style={{ color: colors.muted, fontSize: 12 }}>{item.body}</Text>}<Text style={{ color: colors.muted, fontSize: 10 }}>{new Date(item.created_at).toLocaleString('pl-PL')}</Text></Pressable>)}
  </View></AppModal>;
}

export function TransferSheet({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const { refreshProfile, updateProfileBalance } = useAuth();
  const { canPerformWrites } = useNetwork();
  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState<MoneyTransferRecipient[]>([]);
  const [recipient, setRecipient] = useState<MoneyTransferRecipient | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<MoneyTransferHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  useEffect(() => { if (visible) void fetchMoneyTransferHistory(30).then(setHistory).catch(() => setHistory([])); }, [visible]);
  useEffect(() => { const trimmed = query.trim(); if (trimmed.length < 2 || recipient) { setRecipients([]); return; } const timer = setTimeout(() => void searchMoneyTransferRecipients(trimmed).then(setRecipients).catch(() => setRecipients([])), 250); return () => clearTimeout(timer); }, [query, recipient]);
  const numericAmount = useMemo(() => Number(amount.replace(',', '.')), [amount]);
  const send = async () => {
    if (!canPerformWrites) { Alert.alert('Brak internetu', 'Transfery nie są kolejkowane offline.'); return; }
    if (!recipient || !Number.isFinite(numericAmount) || numericAmount <= 0) { Alert.alert('Sprawdź dane', 'Wybierz odbiorcę i poprawną kwotę.'); return; }
    setLoading(true);
    const idempotencyKey = idempotencyKeyRef.current ?? randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    let result: Awaited<ReturnType<typeof createMoneyTransfer>>;
    try {
      result = await createMoneyTransfer({ recipientId: recipient.id, amount: numericAmount, message: message.trim(), idempotencyKey });
    } catch (cause) {
      setLoading(false);
      Alert.alert('Nie udało się wysłać', cause instanceof Error ? cause.message : 'Spróbuj ponownie.');
      return;
    }
    idempotencyKeyRef.current = null;
    updateProfileBalance(result.balance_after);
    setAmount(''); setMessage(''); setQuery(''); setRecipient(null); setLoading(false);
    Alert.alert('Gotowe', `Wysłano ${result.amount.toFixed(2)} zł do ${result.recipient_username}.`);
    void refreshProfile().catch(() => undefined);
    void fetchMoneyTransferHistory(30).then(setHistory).catch(() => undefined);
  };
  return <AppModal visible={visible} title="Portfel i transfery" onClose={onClose}><View style={{ gap: 12 }}>
    <AppInput label="Odbiorca" placeholder="Wpisz co najmniej 2 znaki" value={query} onChangeText={value => { idempotencyKeyRef.current = null; setQuery(value); setRecipient(null); }} />
    {recipients.map(item => <Pressable key={item.id} onPress={() => { setRecipient(item); setQuery(item.username); setRecipients([]); }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: colors.card, borderRadius: 12 }}><AppAvatar name={item.username} source={item.avatar_url ? { uri: item.avatar_url } : undefined} /><Text style={{ color: colors.foreground, fontWeight: '800' }}>{item.username}</Text></Pressable>)}
    <AppInput label="Kwota" keyboardType="decimal-pad" value={amount} onChangeText={value => { idempotencyKeyRef.current = null; setAmount(value); }} placeholder="0,00" />
    <AppInput label="Wiadomość (opcjonalnie)" value={message} onChangeText={value => { idempotencyKeyRef.current = null; setMessage(value); }} maxLength={140} />
    <AppButton loading={loading} disabled={!canPerformWrites} onPress={() => void send()}>Wyślij pieniądze</AppButton>
    <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '900', marginTop: 8 }}>Historia</Text>
    {history.length === 0 ? <Text style={{ color: colors.muted }}>Brak transferów</Text> : history.map(item => <View key={item.id} style={{ borderRadius: 12, backgroundColor: colors.card, padding: 12, gap: 3 }}><Text style={{ color: colors.foreground, fontWeight: '800' }}>{item.direction === 'sent' ? 'Do' : 'Od'}: {item.counterparty_username}</Text><Text style={{ color: item.direction === 'sent' ? colors.foreground : colors.success, fontWeight: '900' }}>{item.direction === 'sent' ? '−' : '+'}{Number(item.amount).toFixed(2)} zł</Text>{item.message && <Text style={{ color: colors.muted, fontSize: 12 }}>{item.message}</Text>}</View>)}
  </View></AppModal>;
}
