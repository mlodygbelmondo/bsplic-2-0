import { useEffect, useLayoutEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useBootHold } from "@/hooks/useBootSplash";
import {
  holdBoot,
  isBootSplashVisible,
  markAppMounted,
  runBeforeBootReveal,
  setBootPhase,
  setBootProgress,
  showBootSplash,
} from "@/lib/boot/boot-splash";
import { loadAdminPage } from "@/lib/boot/route-modules";
import { queryClient } from "@/lib/query-client";

/**
 * Drives the boot splash from auth state: keeps it up until the session and
 * profile are known, then warms routes, artwork and page data for signed-in
 * players. Signing in later re-opens the splash for the same warm-up;
 * signing out drops the previous player's cached data.
 */
export function BootController() {
  const { user, profile, isAdmin, loading } = useAuth();
  const userId = user?.id ?? null;
  const hasProfile = Boolean(profile);
  const previousUserIdRef = useRef<string | null>(null);
  const isAdminRef = useRef(isAdmin);
  isAdminRef.current = isAdmin;

  useBootHold(loading || (Boolean(userId) && !hasProfile));

  useEffect(() => {
    markAppMounted();
  }, []);

  // Layout effect so the splash covers the screen before the first signed-in
  // frame paints.
  useLayoutEffect(() => {
    const previousUserId = previousUserIdRef.current;
    previousUserIdRef.current = userId;
    if (previousUserId && !userId) {
      queryClient.clear();
    }
    if (userId && !previousUserId && !loading && !isBootSplashVisible()) {
      showBootSplash();
    }
  }, [loading, userId]);

  useEffect(() => {
    if (loading) setBootPhase("session");
  }, [loading]);

  // Code and artwork warm up as soon as the session is known. Page data waits
  // until the first screen has its own data, so it never slows that down.
  useEffect(() => {
    if (!userId) return;

    const release = holdBoot();
    setBootPhase("assets");
    const preload = import("@/lib/boot/preload");

    void preload
      .then(({ warmSignedInAssets }) =>
        warmSignedInAssets((fraction) => setBootProgress(0.2 + fraction * 0.4)),
      )
      .catch((error: unknown) => {
        console.warn("Boot preload failed:", error);
      })
      .finally(release);

    runBeforeBootReveal(() =>
      preload
        .then(({ prefetchPageData }) =>
          prefetchPageData(userId, (fraction) =>
            setBootProgress(0.6 + fraction * 0.35),
          ),
        )
        .then(() => {
          // Roles arrive with the profile, which has loaded by now.
          if (isAdminRef.current) {
            void loadAdminPage().catch(() => undefined);
          }
        }),
    );

    return release;
  }, [userId]);

  return null;
}
