import { useEffect, useState, type ChangeEvent } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge, PublicProfile } from "@/types/database";
import { Navigate, useParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { PlayerCardHero } from "@/features/player-card/components/PlayerCardHero";
import { derivePlayerCardDisplayModel } from "@/features/player-card/displayModel";
import { compressImageFile } from "@/features/social/images";
import { ProfileBadgesSection } from "@/features/profile/components/ProfileBadgesSection";
import { ProfileHistoryPanel } from "@/features/profile/components/ProfileHistoryPanel";
import { useProfileHistory } from "@/features/profile/hooks/useProfileHistory";
import { usePageTitle } from "@/hooks/usePageTitle";

interface UserStatsRow {
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  win_rate: number;
  total_profit: number;
}

function toRankingStats(stats: UserStatsRow) {
  return {
    totalBets: Number(stats.total_bets),
    wins: Number(stats.won_bets),
    losses: Number(stats.lost_bets),
    winRate: Number(stats.win_rate),
    totalProfit: Number(stats.total_profit),
  };
}

function getShareableProfileUrl() {
  return new URL(window.location.pathname, window.location.origin).toString();
}

export default function ProfilePage() {
  usePageTitle("Profil");
  const { user, profile, refreshProfile } = useAuth();
  const { userId: userRef } = useParams<{ userId: string }>();
  const normalizedUserRef = userRef ? decodeURIComponent(userRef) : undefined;

  const [resolvedTargetUserId, setResolvedTargetUserId] = useState<
    string | null
  >(null);
  const [resolvingTarget, setResolvingTarget] = useState(
    Boolean(normalizedUserRef),
  );

  useEffect(() => {
    let cancelled = false;

    const resolveTarget = async () => {
      if (!normalizedUserRef) {
        if (!cancelled) {
          setResolvedTargetUserId(user?.id ?? null);
          setResolvingTarget(false);
        }
        return;
      }

      if (normalizedUserRef === user?.id) {
        if (!cancelled) {
          setResolvedTargetUserId(user.id);
          setResolvingTarget(false);
        }
        return;
      }

      const looksLikeUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          normalizedUserRef,
        );
      if (looksLikeUuid) {
        if (!cancelled) {
          setResolvedTargetUserId(normalizedUserRef);
          setResolvingTarget(false);
        }
        return;
      }

      if (!cancelled) {
        setResolvingTarget(true);
      }

      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", normalizedUserRef)
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        setResolvedTargetUserId(data?.id ?? null);
        setResolvingTarget(false);
      }
    };

    void resolveTarget();

    return () => {
      cancelled = true;
    };
  }, [normalizedUserRef, user?.id]);

  const targetUserId = resolvedTargetUserId;
  const isOwnProfile =
    !normalizedUserRef || (targetUserId !== null && targetUserId === user?.id);

  const [badges, setBadges] = useState<Badge[]>([]);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(
    null,
  );
  const [rankingStats, setRankingStats] = useState<{
    totalBets: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [avatarUploadLoading, setAvatarUploadLoading] = useState(false);
  const [avatarOverrideUrl, setAvatarOverrideUrl] = useState<string | null>(
    null,
  );
  const history = useProfileHistory(targetUserId);

  useEffect(() => {
    if (!targetUserId) return;
    let cancelled = false;

    setBadges([]);
    setPublicProfile(null);
    setRankingStats(null);
    setLoadingProfile(false);

    supabase
      .rpc("get_public_badges", { p_user_id: targetUserId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load profile badges", error);
          setBadges([]);
          return;
        }
        setBadges((data as unknown as Badge[] | null) ?? []);
      });

    if (isOwnProfile) {
      // Fetch only this user's stats instead of recomputing the full leaderboard.
      supabase
        .rpc("get_user_stats", { p_user_id: targetUserId })
        .then(({ data, error }) => {
          if (cancelled || error || !data?.[0]) return;
          setRankingStats(toRankingStats(data[0]));
        });
    } else {
      // Use get_public_profile RPC for other users
      setLoadingProfile(true);
      supabase
        .rpc("get_public_profile", { p_user_id: targetUserId })
        .then(({ data }) => {
          if (cancelled) return;
          if (data) {
            const pp = data as unknown as PublicProfile;
            setPublicProfile(pp);
            setRankingStats({
              totalBets: Number(pp.total_bets),
              wins: Number(pp.won_bets),
              losses: Number(pp.lost_bets),
              winRate: Number(pp.win_rate),
              totalProfit: Number(pp.total_profit),
            });
          }
          setLoadingProfile(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [targetUserId, isOwnProfile]);

  // Own profile requires auth
  if (resolvingTarget) return null;
  if (isOwnProfile && (!user || !profile)) return <Navigate to="/" />;

  const displayName = isOwnProfile
    ? profile!.username
    : (publicProfile?.username ?? "...");
  const displayDate = isOwnProfile
    ? new Date(profile!.created_at).toLocaleDateString("pl-PL")
    : publicProfile
      ? new Date(publicProfile.created_at).toLocaleDateString("pl-PL")
      : "";
  const displayStreak = isOwnProfile
    ? profile!.current_streak
    : (publicProfile?.current_streak ?? 0);
  const playerCardModel = derivePlayerCardDisplayModel({
    totalBets: rankingStats?.totalBets ?? 0,
    wins: rankingStats?.wins ?? 0,
    winRate: rankingStats?.winRate ?? 0,
    totalProfit: rankingStats?.totalProfit ?? 0,
    currentStreak: displayStreak,
  });
  const shareableProfileUrl = getShareableProfileUrl();
  const displayAvatarUrl =
    avatarOverrideUrl ??
    (isOwnProfile
      ? (profile?.avatar_url ?? null)
      : (publicProfile?.avatar_url ?? null));

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile || !user || !profile) return;

    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Wybierz plik obrazu");
      event.target.value = "";
      return;
    }

    setAvatarUploadLoading(true);
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 640,
        targetBytes: 135 * 1024,
        absoluteMaxBytes: 140 * 1024,
        minDimension: 256,
      });

      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, compressed.blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("profile-avatars")
        .getPublicUrl(path);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (profileError) {
        throw new Error(profileError.message);
      }

      setAvatarOverrideUrl(avatarUrl);
      await refreshProfile();
      toast.success("Zdjęcie profilowe zaktualizowane");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nie udało się zaktualizować zdjęcia profilowego";
      toast.error(message);
    } finally {
      setAvatarUploadLoading(false);
      event.target.value = "";
    }
  };

  if (!isOwnProfile && loadingProfile) {
    return (
      <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
        <Navbar />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 space-y-4">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4 space-y-4">
          {/* Header card */}
          <div className="bg-card rounded-xl p-6 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 border border-border">
                  <AvatarImage
                    src={displayAvatarUrl ?? undefined}
                    alt={`Avatar ${displayName}`}
                  />
                  <AvatarFallback className="text-base font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-2xl font-bold">{displayName}</h1>
                  <p className="text-sm text-muted-foreground">
                    Dołączył: {displayDate}
                    {!isOwnProfile && (
                      <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">
                        Profil publiczny
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {isOwnProfile && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className="text-2xl font-bold text-primary">
                    {Number(profile!.balance).toFixed(2)} zł
                  </p>
                </div>
              )}
            </div>

            {isOwnProfile && (
              <div className="mt-3">
                <label
                  htmlFor="profile-avatar-input"
                  className="inline-flex cursor-pointer items-center rounded-md bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/80"
                >
                  {avatarUploadLoading
                    ? "Przesyłanie..."
                    : "Wybierz zdjęcie profilowe"}
                </label>
                <input
                  id="profile-avatar-input"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleAvatarChange}
                  disabled={avatarUploadLoading}
                />
              </div>
            )}
          </div>

          <PlayerCardHero
            model={playerCardModel}
            profileName={displayName}
            profileUrl={shareableProfileUrl}
          />
          <ProfileHistoryPanel history={history} />

          {targetUserId && <ProfileBadgesSection badges={badges} />}
        </div>
      </div>
    </div>
  );
}
