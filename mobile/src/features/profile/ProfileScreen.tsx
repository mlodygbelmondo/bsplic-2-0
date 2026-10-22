import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { authActions, useAuthStore, useUserId } from '@/features/auth/auth-store';
import { derivePlayerCardDisplayModel } from '@/features/player-card/displayModel';
import { PlayerCardHero } from '@/features/player-card/PlayerCardHero';
import { ReplayLaunchCard } from '@/features/replay/ReplayLaunchCard';
import { AppHeader } from '@/features/shell/AppHeader';
import { useIsOffline, whenOnline } from '@/lib/connectivity';
import { env } from '@/lib/env';
import { useHasBeenFocused, useScreenVisible } from '@/lib/focus';
import { createStyles, useTheme } from '@/theme';
import type { Badge } from '@/types/database';
import { ScreenBackground } from '@/ui';
import {
  profileBadgesQueryOptions,
  profileIdByUsernameQueryOptions,
  profileStatsQueryOptions,
  publicProfileQueryOptions,
  type RankingStats,
} from './api/profileQueries';
import { useAvatarUpload } from './avatar/useAvatarUpload';
import { ProfileBadgesSection } from './components/ProfileBadgesSection';
import { ProfileHeaderCard } from './components/ProfileHeaderCard';
import { ProfileHistoryPanel } from './components/ProfileHistoryPanel';
import { ProfileLoadError, ProfileNotFound, ProfilePageLoader } from './components/ProfileStates';
import { useProfileHistory, type ProfileHistoryState } from './hooks/useProfileHistory';
import { formatJoinDate } from './logic/format';
import { parseProfileRef } from './logic/profileTarget';

/** Tab "Profil" (web `/profile`). Mounted eagerly by NativeTabs: nothing loads before first focus. */
export function OwnProfileScreen() {
  const seen = useHasBeenFocused();
  return (
    <ScreenBackground>
      <AppHeader />
      {seen ? <OwnProfileContent /> : null}
    </ScreenBackground>
  );
}

/** `/profile/:userId` pushed over the tabs; the ref is a user id or a username, like the web. */
export function PublicProfileScreen() {
  const { userId: ref } = useLocalSearchParams<{ userId: string }>();
  const currentUserId = useUserId();
  const target = parseProfileRef(ref, currentUserId);

  return (
    <ScreenBackground>
      <AppHeader back />
      {target.kind === 'own' ? (
        <OwnProfileContent />
      ) : target.kind === 'id' ? (
        <OtherProfileContent userId={target.userId} />
      ) : (
        <UsernameProfileContent username={target.username} />
      )}
    </ScreenBackground>
  );
}

function UsernameProfileContent({ username }: { username: string }) {
  const currentUserId = useUserId();
  const lookup = useQuery(profileIdByUsernameQueryOptions(username));

  if (lookup.isPending) return <ProfilePageLoader />;
  if (lookup.isError) return <ProfileLoadError onRetry={() => void lookup.refetch()} />;
  if (!lookup.data) return <ProfileNotFound />;
  if (lookup.data === currentUserId) return <OwnProfileContent />;
  return <OtherProfileContent userId={lookup.data} />;
}

function OwnProfileContent() {
  const userId = useUserId();
  // Only the fields shown here: balance updates must not re-render the profile.
  const profile = useAuthStore(
    useShallow((s) =>
      s.profile
        ? {
            username: s.profile.username,
            created_at: s.profile.created_at,
            avatar_url: s.profile.avatar_url,
            current_streak: s.profile.current_streak,
          }
        : null,
    ),
  );
  const profileStatus = useAuthStore((s) => s.profileStatus);
  const offline = useIsOffline();
  const history = useProfileHistory(userId);
  const avatar = useAvatarUpload(userId, offline);

  // Tabs stay mounted: resubscribing when on view refetches (`refetchOnMount: 'always'`), like a web page visit.
  const focused = useScreenVisible();
  const badgesQuery = useQuery({
    ...profileBadgesQueryOptions(userId ?? ''),
    enabled: Boolean(userId),
    subscribed: focused,
  });
  // Own stats come from a cheap per-user RPC; other players need the public
  // profile RPC, which also carries their name and avatar.
  const statsQuery = useQuery({
    ...profileStatsQueryOptions(userId ?? ''),
    enabled: Boolean(userId),
    subscribed: focused,
  });
  useLogBadgesError(badgesQuery.error);

  if (!userId || !profile) {
    if (profileStatus === 'error') return <ProfileLoadError onRetry={() => void authActions.refreshProfile()} />;
    return <ProfilePageLoader />;
  }

  return (
    <ProfileBody
      isOwnProfile
      userId={userId}
      displayName={profile.username}
      displayDate={formatJoinDate(profile.created_at)}
      avatarUrl={avatar.overrideUrl ?? profile.avatar_url ?? null}
      stats={statsQuery.data ?? null}
      streak={profile.current_streak}
      badges={badgesQuery.data ?? []}
      history={history}
      avatarUpload={{ uploading: avatar.uploading, offline, onPick: () => void avatar.pickAndUpload() }}
      onRefresh={() =>
        Promise.all([authActions.refreshProfile(), statsQuery.refetch(), badgesQuery.refetch(), history.refresh()])
      }
    />
  );
}

function OtherProfileContent({ userId }: { userId: string }) {
  const history = useProfileHistory(userId);
  const publicQuery = useQuery(publicProfileQueryOptions(userId));
  const badgesQuery = useQuery(profileBadgesQueryOptions(userId));
  useLogBadgesError(badgesQuery.error);

  if (publicQuery.isPending) return <ProfilePageLoader />;
  if (publicQuery.isError && publicQuery.data === undefined) {
    return <ProfileLoadError onRetry={() => void publicQuery.refetch()} />;
  }
  const publicProfile = publicQuery.data;
  if (!publicProfile) return <ProfileNotFound />;

  return (
    <ProfileBody
      isOwnProfile={false}
      userId={userId}
      displayName={publicProfile.username}
      displayDate={formatJoinDate(publicProfile.created_at)}
      avatarUrl={publicProfile.avatar_url ?? null}
      stats={{
        totalBets: Number(publicProfile.total_bets),
        wins: Number(publicProfile.won_bets),
        losses: Number(publicProfile.lost_bets),
        winRate: Number(publicProfile.win_rate),
        totalProfit: Number(publicProfile.total_profit),
      }}
      streak={publicProfile.current_streak ?? 0}
      badges={badgesQuery.data ?? []}
      history={history}
      onRefresh={() => Promise.all([publicQuery.refetch(), badgesQuery.refetch(), history.refresh()])}
    />
  );
}

function useLogBadgesError(error: unknown) {
  useEffect(() => {
    if (error) console.error('Failed to load profile badges', error);
  }, [error]);
}

interface ProfileBodyProps {
  isOwnProfile: boolean;
  userId: string;
  displayName: string;
  displayDate: string;
  avatarUrl: string | null;
  stats: RankingStats | null;
  streak: number;
  badges: Badge[];
  history: ProfileHistoryState;
  avatarUpload?: { uploading: boolean; offline: boolean; onPick: () => void };
  onRefresh: () => Promise<unknown>;
}

/** Web `ProfilePage` layout: header card, player card, replay (own), history, badges. */
function ProfileBody({
  isOwnProfile,
  userId,
  displayName,
  displayDate,
  avatarUrl,
  stats,
  streak,
  badges,
  history,
  avatarUpload,
  onRefresh,
}: ProfileBodyProps) {
  const model = derivePlayerCardDisplayModel({
    totalBets: stats?.totalBets ?? 0,
    wins: stats?.wins ?? 0,
    winRate: stats?.winRate ?? 0,
    totalProfit: stats?.totalProfit ?? 0,
    currentStreak: streak,
  });

  return (
    <RefreshableScroll onRefresh={onRefresh}>
      <ProfileHeaderCard
        displayName={displayName}
        displayDate={displayDate}
        avatarUrl={avatarUrl}
        isOwnProfile={isOwnProfile}
        avatarUpload={avatarUpload}
      />
      <PlayerCardHero model={model} profileName={displayName} profileUrl={`${env.webUrl}/profile/${userId}`} />
      {isOwnProfile ? <ReplayLaunchCard /> : null}
      <ProfileHistoryPanel history={history} />
      <ProfileBadgesSection badges={badges} />
    </RefreshableScroll>
  );
}

function RefreshableScroll({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    return onRefresh()
      // Each query keeps its cached data and shows its own error state.
      .catch((error: unknown) => console.warn('Profile refresh failed', error))
      .finally(() => setRefreshing(false));
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={whenOnline(() => void handleRefresh())} tintColor={colors.mutedForeground} />
      }
    >
      {children}
    </ScrollView>
  );
}

const useStyles = createStyles(() => ({
  // max-w-4xl mx-auto p-4 space-y-4
  content: { padding: 16, gap: 16 },
}));
