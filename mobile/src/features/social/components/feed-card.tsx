import { useState } from 'react';
import { Copy, Globe2, MessageCircle, Share2 } from 'lucide-react-native';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { AppAvatar } from '@/components/ui/AppAvatar';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/hooks/use-app-theme';
import { env } from '@/lib/env';
import type { FeedItemType, ReactionEmoji, SocialComment, SocialFeedItem } from '@/types/database';

import { formatSocialTimeAgo } from '../lib/socialFormatters';
import { CommentThread } from './comments';
import { ReactionBar, type ReactionTarget } from './reactions';
import { SocialContent } from './social-content';

interface FeedCardProps {
  item: SocialFeedItem;
  comments: SocialComment[];
  commentsLoaded: boolean;
  commentsLoading: boolean;
  writesDisabled: boolean;
  copying?: boolean;
  highlighted?: boolean;
  showComments?: boolean;
  onOpen?(): void;
  onCopyCoupon?(): void;
  onLoadComments(): void;
  onComposeComment(parentId?: string, initialText?: string): void;
  onReact(emoji: ReactionEmoji): void;
  onReactComment(commentId: string, emoji: ReactionEmoji): void;
  onOpenReactors(target: ReactionTarget): void;
}

export function FeedCard({ item, comments, commentsLoaded, commentsLoading, writesDisabled, copying, highlighted, showComments = true, onOpen, onCopyCoupon, onLoadComments, onComposeComment, onReact, onReactComment, onOpenReactors }: FeedCardProps) {
  const { tokens } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const target = getReactionTarget(item.item_type, item.id);
  const share = async () => {
    const url = `${env.webUrl}/social/${item.item_type}/${item.id}`;
    try { await Share.share({ title: `${item.username} w Socialu`, message: url, url }); } catch { /* cancelled native share */ }
  };
  const openComments = () => {
    if (!commentsLoaded) onLoadComments();
    else onComposeComment();
  };
  return (
    <View style={[styles.card, { backgroundColor: tokens.colors.card, borderColor: highlighted ? tokens.colors.primary : tokens.colors.border }]}>
      <Pressable accessibilityRole={onOpen ? 'button' : undefined} onPress={onOpen} disabled={!onOpen} style={styles.header}>
        <AppAvatar name={item.username} source={item.avatar_url ? { uri: item.avatar_url } : undefined} size={40} />
        <View style={styles.headerText}>
          <AppText variant="label" numberOfLines={1}>{item.username}</AppText>
          <View style={styles.timestamp}>
            <AppText variant="caption" tone="muted">{formatSocialTimeAgo(item.created_at)}</AppText>
            <Globe2 size={12} color={tokens.colors.mutedForeground} />
          </View>
        </View>
        {item.item_type === 'coupon' && onCopyCoupon ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Skopiuj kupon" disabled={copying || writesDisabled} onPress={onCopyCoupon} style={[styles.copy, { borderColor: tokens.colors.border }]}>
            <Copy size={15} color={tokens.colors.primary} />
            <AppText variant="caption" tone="primary">{copying ? 'Kopiuję…' : 'Kopiuj'}</AppText>
          </Pressable>
        ) : null}
      </Pressable>

      <View style={styles.body}>
        {item.item_type === 'post' ? <SocialContent content={item.content} /> : null}
        {item.item_type === 'coupon' ? <CouponContent item={item} expanded={expanded} onToggle={() => setExpanded((value) => !value)} /> : null}
        {item.item_type === 'casino' ? <CasinoContent item={item} /> : null}
      </View>

      <View style={[styles.engagement, { borderTopColor: tokens.colors.border }]}>
        <View style={styles.engagementTop}>
          <ReactionBar reactions={item.reactions} myReaction={item.my_reaction} disabled={writesDisabled} onToggle={onReact} onOpenReactors={() => onOpenReactors(target)} />
          <AppText variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>{item.comment_count ?? 0} komentarzy</AppText>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={writesDisabled} onPress={openComments} style={styles.action}>
            <MessageCircle size={17} color={tokens.colors.mutedForeground} />
            <AppText variant="caption" tone="muted">Komentarz</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void share()} style={styles.action}>
            <Share2 size={17} color={tokens.colors.mutedForeground} />
            <AppText variant="caption" tone="muted">Udostępnij</AppText>
          </Pressable>
        </View>
        {writesDisabled ? <AppText variant="caption" tone="muted">Reakcje i komentarze wymagają połączenia z internetem.</AppText> : null}
        {showComments && (commentsLoaded || commentsLoading) ? (
          <CommentThread itemId={item.id} itemType={item.item_type} comments={comments} loaded={commentsLoaded} loading={commentsLoading} disabled={writesDisabled} onLoad={onLoadComments} onCompose={onComposeComment} onReact={onReactComment} onOpenReactors={onOpenReactors} />
        ) : null}
      </View>
    </View>
  );
}

function CouponContent({ item, expanded, onToggle }: { item: SocialFeedItem; expanded: boolean; onToggle(): void }) {
  const { tokens } = useAppTheme();
  const legs = item.legs ?? [];
  const status = deriveStatus(item);
  const odds = Number(item.total_odds ?? legs.reduce((total, leg) => total * Number(leg.odds_at_time || 1), 1));
  return (
    <Pressable accessibilityRole={legs.length > 1 ? 'button' : undefined} onPress={legs.length > 1 ? onToggle : undefined} style={[styles.ticket, { backgroundColor: tokens.colors.muted }]}>
      <View style={styles.ticketHead}>
        <View style={styles.flex}>
          <AppText variant="label">{legs.length > 1 ? `AKO ${legs.length}` : legs[0]?.bet_title || 'Zakład'}</AppText>
          <AppText variant="caption" tone="muted">kurs {odds.toFixed(2)}{legs.length > 1 ? expanded ? '  ▲' : '  ▼' : ''}</AppText>
        </View>
        <View style={styles.right}>
          <AppText variant="label">{Number(item.stake ?? 0).toFixed(2)} zł</AppText>
          <AppText variant="caption" tone={status === 'won' ? 'success' : status === 'lost' ? 'danger' : 'muted'}>{statusLabel(status, item)}</AppText>
        </View>
      </View>
      {legs.length === 1 ? <AppText variant="caption" tone="muted">{legs[0]?.selected_option}</AppText> : null}
      {expanded ? legs.map((leg) => (
        <View key={leg.id} style={[styles.leg, { borderTopColor: tokens.colors.border }]}>
          <View style={styles.flex}><AppText variant="caption" numberOfLines={1}>{leg.bet_title || 'Zakład'}</AppText><AppText variant="caption" tone="muted">{leg.selected_option} · {Number(leg.odds_at_time).toFixed(2)}</AppText></View>
          <AppText variant="caption" tone={leg.result === 'won' ? 'success' : leg.result === 'lost' ? 'danger' : 'muted'}>{statusLabel(leg.result)}</AppText>
        </View>
      )) : null}
    </Pressable>
  );
}

function CasinoContent({ item }: { item: SocialFeedItem }) {
  const { tokens } = useAppTheme();
  const labels: Record<string, string> = { straight: 'Numer', color: 'Kolor', parity: 'Parzystość', range: 'Zakres' };
  return (
    <View style={[styles.ticket, { backgroundColor: tokens.colors.muted }]}>
      <View style={styles.ticketHead}>
        <View style={styles.flex}>
          <AppText variant="label" tone="primary">Ruletka{item.casino_round_number ? ` · runda #${item.casino_round_number}` : ''}</AppText>
          <AppText>{labels[item.casino_bet_type ?? ''] ?? 'Zakład'}: {item.casino_bet_value || '—'}</AppText>
          <AppText variant="caption" tone="muted">Wynik: {item.casino_winning_number ?? 'niedostępny'}</AppText>
        </View>
        <View style={styles.right}><AppText variant="label">{Number(item.casino_stake ?? 0).toFixed(2)} zł</AppText><AppText variant="caption" tone="success">+{Number(item.casino_payout ?? 0).toFixed(2)} zł</AppText></View>
      </View>
    </View>
  );
}

function deriveStatus(item: SocialFeedItem) {
  if (item.status === 'won' || item.status === 'lost' || item.status === 'refund') return item.status;
  const results = item.legs?.map((leg) => leg.result) ?? [];
  if (results.some((result) => result === 'lost')) return 'lost';
  if (results.length > 0 && results.every((result) => result === 'won' || result === 'refund')) return results.some((result) => result === 'won') ? 'won' : 'refund';
  return 'pending';
}

function statusLabel(status: string, item?: SocialFeedItem) {
  if (status === 'won') return item ? `+${Number(item.payout ?? 0).toFixed(2)} zł` : 'Wygrana';
  if (status === 'lost') return 'Przegrana';
  if (status === 'refund') return 'Zwrot';
  return 'W toku';
}

function getReactionTarget(type: FeedItemType, id: string): ReactionTarget {
  return type === 'post' ? { postId: id } : type === 'coupon' ? { couponId: id } : { casinoShareId: id };
}

const styles = StyleSheet.create({
  card: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  headerText: { flex: 1, minWidth: 0 },
  timestamp: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copy: { minHeight: 38, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9 },
  body: { paddingHorizontal: 14, paddingBottom: 12 },
  ticket: { borderRadius: 12, padding: 12, gap: 8 },
  ticketHead: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  leg: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7, flexDirection: 'row', gap: 8 },
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  engagement: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 9, gap: 8 },
  engagementTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actions: { flexDirection: 'row' },
  action: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' },
});
