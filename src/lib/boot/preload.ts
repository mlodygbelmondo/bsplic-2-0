import {
  blackjackSnapshotQuery,
  rouletteSnapshotQuery,
} from "@/features/casino/api/casinoQueries";
import {
  casinoHistoryPreviewQuery,
  profileBadgesQuery,
  profileStatsQuery,
  sportsbookHistoryPreviewQuery,
} from "@/features/profile/api/profileQueries";
import { rankingsQuery } from "@/features/rankings/queries";
import { SLOT_GAMES } from "@/features/slots/model";
import {
  socialFeedQuery,
  socialStoriesQuery,
} from "@/features/social/api/socialQueries";
import { SIGNED_IN_ROUTE_LOADERS } from "@/lib/boot/route-modules";
import { queryClient } from "@/lib/query-client";

// Warms route chunks, artwork and each section's data while the boot splash
// is up, so opening the casino or any other section later renders instantly
// with images and content in place. The splash waits at most
// CRITICAL_TIMEOUT_MS for each group; the rest continues in the background.

const CRITICAL_TIMEOUT_MS = 3000;

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

// Warmed images stay referenced so the browser's in-memory image cache keeps
// them for the lifetime of the page instead of revalidating on first use.
const warmedImages: HTMLImageElement[] = [];
let assetsWarmed = false;

function isDataSaverOn() {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection;
  return (
    connection?.saveData === true ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}

function warmImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
    warmedImages.push(image);
  });
}

function getCriticalImages() {
  const desktop = window.matchMedia("(min-width: 768px)").matches;
  return [
    "/jackpot/daily-jackpot-prizes.webp",
    desktop ? "/casino/hub-image.webp" : "/casino/hub-mobile-background.webp",
    ...Object.values(SLOT_GAMES).map((game) => game.image),
    "/casino/roulette-cover.webp",
    "/casino/blackjack-cover.webp",
    "/casino/slots/symbols.webp",
    "/casino/slots/symbols-forge-tide.webp",
    "/casino/roulette-table.webp",
    "/casino/roulette-wheel-new-3.webp",
    "/casino/blackjack-table.webp",
    "/casino/blackjack-card-reverse.webp",
  ];
}

const BACKGROUND_IMAGES = [
  "/jackpot/jackpot-draw-stage.webp",
  "/jackpot/jackpot-ticket.webp",
  "/jackpot/jackpot-winning-ticket.webp",
  "/casino/roulette-background.webp",
];

function runWhenIdle(task: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(task, { timeout: 4000 });
  } else {
    window.setTimeout(task, 1200);
  }
}

/** First screen of every main section, for the signed-in player. */
function getPageDataTasks(userId: string): Array<() => Promise<unknown>> {
  return [
    () => queryClient.prefetchQuery(socialFeedQuery(userId)),
    () => queryClient.prefetchQuery(socialStoriesQuery()),
    () => queryClient.prefetchQuery(profileStatsQuery(userId)),
    () => queryClient.prefetchQuery(profileBadgesQuery(userId)),
    () => queryClient.prefetchQuery(sportsbookHistoryPreviewQuery(userId)),
    () => queryClient.prefetchQuery(casinoHistoryPreviewQuery(userId)),
    () => queryClient.prefetchQuery(rankingsQuery("sportsbook")),
    () => queryClient.prefetchQuery(rouletteSnapshotQuery()),
    () => queryClient.prefetchQuery(blackjackSnapshotQuery(userId)),
  ];
}

function runWithinBudget(
  tasks: Array<() => Promise<unknown>>,
  onProgress: (fraction: number) => void,
) {
  let settled = 0;
  const all = Promise.allSettled(
    tasks.map((task) =>
      task()
        .catch((error: unknown) => {
          console.warn("Boot preload task failed:", error);
        })
        .finally(() => {
          settled += 1;
          onProgress(settled / tasks.length);
        }),
    ),
  );
  const budget = new Promise<void>((resolve) =>
    window.setTimeout(resolve, CRITICAL_TIMEOUT_MS),
  );
  return Promise.race([all, budget]);
}

/**
 * Warms route chunks and artwork (served by the app host, so they don't
 * compete with API requests). Once per page load; resolves when the
 * critical set is ready or the time budget runs out.
 */
export function warmSignedInAssets(onProgress: (fraction: number) => void) {
  if (assetsWarmed) return Promise.resolve();
  assetsWarmed = true;

  const saveData = isDataSaverOn();
  const tasks: Array<() => Promise<unknown>> = [
    ...SIGNED_IN_ROUTE_LOADERS,
    ...(saveData ? [] : getCriticalImages().map((src) => () => warmImage(src))),
  ];

  return runWithinBudget(tasks, onProgress).then(() => {
    if (saveData) return;
    runWhenIdle(() => {
      BACKGROUND_IMAGES.forEach((src) => void warmImage(src));
    });
  });
}

/**
 * Fetches the first screen of every section for this player. Run it after
 * the current screen has its data: parallel API requests slow each other
 * down. Resolves when done or when the time budget runs out; stragglers
 * still land in the cache.
 */
export function prefetchPageData(
  userId: string,
  onProgress: (fraction: number) => void,
) {
  return runWithinBudget(getPageDataTasks(userId), onProgress);
}
