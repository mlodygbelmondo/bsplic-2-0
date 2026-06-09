import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { LogOut, ShieldCheck, Wallet, Menu } from "lucide-react";
import { toast } from "sonner";
import { canClaimTopup } from "@/features/social/polishDay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const NotificationsBell = lazy(() =>
  import("@/features/notifications/components/NotificationsBell").then(
    (module) => ({ default: module.NotificationsBell }),
  ),
);
const NavbarMobileMenu = lazy(() => import("./NavbarMobileMenu"));
const NavbarTopupDialog = lazy(() => import("./NavbarTopupDialog"));

export function Navbar() {
  const { user, profile, isAdmin, isModerator, signOut, refreshProfile } =
    useAuth();
  const location = useLocation();
  const [topupOpen, setTopupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDesktopNav, setIsDesktopNav] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktopNav(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const isActivePath = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  const canTopup = () => canClaimTopup(profile?.last_topup_at);

  const openTopupDialog = () => {
    if (!canTopup()) {
      toast.error("Już doładowano dzisiaj. Wróć jutro!");
      return;
    }

    setTopupOpen(true);
  };

  const navLinks = [
    { to: "/", label: "Zakłady" },
    { to: "/casino", label: "Kasyno" },
    { to: "/social", label: "Social" },
    { to: "/rankings", label: "Rankingi" },
  ];

  if (isAdmin) {
    navLinks.push({ to: "/admin", label: "Admin" });
  }

  return (
    <>
      <nav className="gradient-navbar safe-area-top fixed inset-x-0 top-0 z-50 shadow-md">
        <div className="flex items-center justify-between px-4 h-11 max-w-[1600px] mx-auto">
          {/* Left */}
          <div className="flex items-center gap-5">
            <Link
              to="/"
              className="text-[17px] font-black text-primary-foreground tracking-tight hover:brightness-110 transition leading-none"
            >
              BSPLIC 2.0
            </Link>
            <div className="hidden lg:flex items-center gap-4">
              <Link
                to="/"
                className={cn(
                  "text-[14px] font-semibold hover:text-primary-foreground hover:brightness-110 transition-colors leading-none",
                  isActivePath("/")
                    ? "text-primary-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                Zakłady
              </Link>
              <Link
                to="/casino"
                className={cn(
                  "text-[14px] font-semibold hover:text-primary-foreground transition-colors leading-none",
                  isActivePath("/casino")
                    ? "text-primary-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                Kasyno
              </Link>
              <Link
                to="/social"
                className={cn(
                  "text-[14px] font-semibold hover:text-primary-foreground transition-colors leading-none",
                  isActivePath("/social")
                    ? "text-primary-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                Social
              </Link>
              <Link
                to="/rankings"
                className={cn(
                  "text-[14px] font-semibold hover:text-primary-foreground transition-colors leading-none",
                  isActivePath("/rankings")
                    ? "text-primary-foreground"
                    : "text-primary-foreground/70",
                )}
              >
                Rankingi
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={cn(
                    "inline-flex items-center gap-1 text-[14px] font-semibold leading-none hover:text-primary-foreground transition-colors",
                    isActivePath("/admin")
                      ? "text-primary-foreground"
                      : "text-primary-foreground/70",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" /> Admin
                </Link>
              )}
              {!isAdmin && isModerator && (
                <Link
                  to="/admin"
                  className={cn(
                    "inline-flex items-center gap-1 text-[14px] font-semibold leading-none hover:text-primary-foreground transition-colors",
                    isActivePath("/admin")
                      ? "text-primary-foreground"
                      : "text-primary-foreground/70",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" /> Propozycje
                </Link>
              )}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2.5">
            {isDesktopNav && (
              <Suspense fallback={null}>
                <NotificationsBell userId={user?.id} />
              </Suspense>
            )}
            {profile && (
              <button
                onClick={openTopupDialog}
                className="flex items-center gap-1 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground px-2.5 py-1 rounded-full text-[12px] font-bold transition-colors"
                title={
                  canTopup()
                    ? "Doładuj portfel"
                    : "Już doładowano dzisiaj. Wróć jutro!"
                }
              >
                <Wallet className="h-3 w-3" />
                {Number(profile.balance).toFixed(2)} zł
              </button>
            )}
            {profile && (
              <Link
                to="/profile"
                className="flex items-center gap-1.5 text-primary-foreground text-[12px] font-medium hover:brightness-110 transition"
              >
                <Avatar className="h-6 w-6 bg-primary-foreground/20">
                  <AvatarImage
                    src={profile.avatar_url ?? undefined}
                    alt={`Avatar ${profile.username}`}
                  />
                  <AvatarFallback className="bg-primary-foreground/20 text-[10px] font-bold text-primary-foreground">
                    {profile.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{profile.username}</span>
              </Link>
            )}
            <button
              onClick={() => signOut()}
              className="text-primary-foreground/60 hover:text-primary-foreground transition-colors ml-1"
              title="Wyloguj"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="lg:hidden flex items-center gap-2">
            {!isDesktopNav && (
              <Suspense fallback={null}>
                <NotificationsBell
                  userId={user?.id}
                  className="h-8 w-8 [&>svg]:h-6 [&>svg]:w-6"
                />
              </Suspense>
            )}
            <button
              type="button"
              aria-label="Otwórz menu"
              className="text-primary-foreground/90 flex items-center justify-center hover:text-primary-foreground transition-colors p-1"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            {mobileMenuOpen && (
              <Suspense fallback={null}>
                <NavbarMobileMenu
                  open={mobileMenuOpen}
                  onOpenChange={setMobileMenuOpen}
                  navLinks={navLinks}
                  isActivePath={isActivePath}
                  profile={profile}
                  canTopup={canTopup}
                  onOpenTopup={() => setTopupOpen(true)}
                  signOut={signOut}
                />
              </Suspense>
            )}
          </div>
        </div>
      </nav>

      <div className="navbar-offset" aria-hidden="true" />

      {topupOpen && (
        <Suspense fallback={null}>
          <NavbarTopupDialog
            open={topupOpen}
            onOpenChange={setTopupOpen}
            userId={user?.id}
            profile={profile}
            refreshProfile={refreshProfile}
          />
        </Suspense>
      )}
    </>
  );
}
