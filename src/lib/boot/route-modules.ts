// Route chunk loaders shared by the router (React.lazy) and the boot
// preloader, so warming a route during the splash hits the exact chunk the
// router will request later.

export const loadAuthenticatedHome = () =>
  import("@/features/home/components/AuthenticatedHome");
export const loadProfilePage = () => import("@/pages/ProfilePage");
export const loadReplayPage = () => import("@/features/replay/ReplayPage");
export const loadRankingsPage = () => import("@/pages/RankingsPage");
export const loadSocialPage = () => import("@/pages/SocialPage");
export const loadSocialItemPage = () => import("@/pages/SocialItemPage");
export const loadAdminPage = () => import("@/pages/AdminPage");
export const loadResetPasswordPage = () => import("@/pages/ResetPasswordPage");
export const loadNotFound = () => import("@/pages/NotFound");
export const loadCasinoLayout = () => import("@/pages/CasinoLayout");
export const loadCasinoHub = () => import("@/pages/CasinoHub");
export const loadCasinoRoulettePage = () => import("@/pages/CasinoRoulettePage");
export const loadCasinoBlackjackPage = () =>
  import("@/pages/CasinoBlackjackPage");
export const loadSlotsPage = () => import("@/features/slots/SlotsPage");
export const loadJackpotDrawPage = () =>
  import("@/features/jackpot/pages/JackpotDrawPage");

/** Everything a signed-in player can reach from the main navigation. */
export const SIGNED_IN_ROUTE_LOADERS = [
  loadAuthenticatedHome,
  loadCasinoLayout,
  loadCasinoHub,
  loadSocialPage,
  loadRankingsPage,
  loadProfilePage,
  loadCasinoRoulettePage,
  loadCasinoBlackjackPage,
  loadSlotsPage,
  loadSocialItemPage,
  loadJackpotDrawPage,
  loadReplayPage,
];
