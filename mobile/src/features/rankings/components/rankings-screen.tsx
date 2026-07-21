import { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/integrations/supabase/client';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/providers/auth-provider';

type RankingType = 'sportsbook' | 'casino';
type SortKey = 'total_profit' | 'win_rate' | 'total_bets';

interface RankEntry {
  id: string;
  username: string;
  total_profit: number;
  win_rate: number;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  balance: number;
}

async function fetchRankings(type: RankingType): Promise<RankEntry[]> {
  const { data, error } = await supabase.rpc(
    type === 'sportsbook' ? 'get_user_rankings' : 'get_casino_rankings',
  );
  if (error) throw error;

  return ((data ?? []) as unknown as RankEntry[]).map((entry) => ({
    ...entry,
    total_profit: Number(entry.total_profit),
    win_rate: Number(entry.win_rate),
    total_bets: Number(entry.total_bets),
    won_bets: Number(entry.won_bets),
    lost_bets: Number(entry.lost_bets),
    balance: Number(entry.balance),
  }));
}

function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const { tokens } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, borderRadius: 12, backgroundColor: tokens.colors.card, padding: 4 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 32,
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 9,
              backgroundColor: selected ? tokens.colors.primary : 'transparent',
              paddingHorizontal: 10,
            }}>
            <Text allowFontScaling={false} style={{ color: selected ? tokens.colors.primaryForeground : tokens.colors.mutedForeground, fontSize: 12, fontWeight: '800' }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RankingsScreen() {
  const { tokens } = useAppTheme();
  const { user } = useAuth();
  const [type, setType] = useState<RankingType>('sportsbook');
  const [sort, setSort] = useState<SortKey>('total_profit');
  const { data = [], error, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['rankings', type],
    queryFn: () => fetchRankings(type),
  });
  const rankings = useMemo(
    () => [...data].sort((a, b) => b[sort] - a[sort]),
    [data, sort],
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: tokens.colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 96 }}
      data={rankings}
      keyExtractor={(entry) => entry.id}
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
      ListHeaderComponent={
        <View style={{ gap: 9, paddingTop: 8, paddingBottom: 10 }}>
          <Text selectable allowFontScaling={false} style={{ color: tokens.colors.foreground, fontSize: 20, fontWeight: '800' }}>
            Rankingi
          </Text>
          <Segment
            options={[
              { value: 'sportsbook', label: 'Zakłady' },
              { value: 'casino', label: 'Kasyno' },
            ]}
            value={type}
            onChange={setType}
          />
          <Segment
            options={[
              { value: 'total_profit', label: 'Profit' },
              { value: 'win_rate', label: 'Win rate' },
              { value: 'total_bets', label: 'Zakłady' },
            ]}
            value={sort}
            onChange={setSort}
          />
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <ActivityIndicator color={tokens.colors.primary} style={{ padding: 50 }} />
        ) : error ? (
          <View style={{ alignItems: 'center', gap: 10, padding: 40 }}>
            <Text selectable style={{ color: tokens.colors.foreground, fontWeight: '800' }}>
              Nie udało się wczytać rankingu
            </Text>
            <Pressable onPress={() => void refetch()} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ color: tokens.colors.primary, fontWeight: '800' }}>Spróbuj ponownie</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={{ color: tokens.colors.mutedForeground, padding: 40, textAlign: 'center' }}>
            {type === 'sportsbook'
              ? 'Nikt jeszcze nie postawił zakładu.'
              : 'Nikt jeszcze nie zagrał w kasynie.'}
          </Text>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: tokens.colors.border }} />}
      renderItem={({ item, index }) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
        const isMe = item.id === user?.id;
        const primaryValue =
          sort === 'win_rate'
            ? `${item.win_rate.toFixed(1)}%`
            : sort === 'total_bets'
              ? String(item.total_bets)
              : `${item.total_profit >= 0 ? '+' : ''}${item.total_profit.toFixed(2)} zł`;

        return (
          <Link href={`/profile/${item.id}`} asChild>
            <Pressable
              accessibilityRole="link"
              style={{
                minHeight: 66,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderRadius: isMe ? 12 : 0,
                borderCurve: 'continuous',
                borderWidth: isMe ? 1 : 0,
                borderColor: tokens.colors.primary,
                backgroundColor: isMe ? tokens.colors.secondary : tokens.colors.card,
                paddingHorizontal: 8,
                paddingVertical: 7,
              }}>
              <Text allowFontScaling={false} style={{ width: 28, textAlign: 'center', color: tokens.colors.foreground, fontSize: 16, fontWeight: '900' }}>
                {medal}
              </Text>
              <View style={{ flex: 1, gap: 4 }}>
                <Text allowFontScaling={false} numberOfLines={1} style={{ color: tokens.colors.foreground, fontSize: 14, fontWeight: '700' }}>
                  {item.username}{isMe ? ' (ty)' : ''}
                </Text>
                <Text allowFontScaling={false} style={{ color: tokens.colors.mutedForeground, fontSize: 10 }}>
                  Profit {item.total_profit >= 0 ? '+' : ''}{item.total_profit.toFixed(2)} zł · WR {item.win_rate.toFixed(1)}% · {item.total_bets} zakł.
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <Text allowFontScaling={false} style={{ color: tokens.colors.mutedForeground, fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>
                  {sort === 'total_profit' ? 'Profit' : sort === 'win_rate' ? 'Win rate' : 'Zakłady'}
                </Text>
                <Text
                  selectable
                  allowFontScaling={false}
                  style={{
                    fontSize: 14,
                    color:
                      sort !== 'total_profit'
                        ? tokens.colors.foreground
                        : item.total_profit > 0
                          ? tokens.colors.success
                          : item.total_profit < 0
                            ? tokens.colors.destructive
                            : tokens.colors.foreground,
                    fontWeight: '900',
                    fontVariant: ['tabular-nums'],
                  }}>
                  {primaryValue}
                </Text>
              </View>
            </Pressable>
          </Link>
        );
      }}
    />
  );
}
