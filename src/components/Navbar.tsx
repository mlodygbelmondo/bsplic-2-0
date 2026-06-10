import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { canClaimTopup } from "@/features/social/polishDay";
import { useTheme } from "@/contexts/ThemeContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NotificationsBell = lazy(() =>
  import("@/features/notifications/components/NotificationsBell").then(
    (module) => ({ default: module.NotificationsBell }),
  ),
);
const NavbarMobileMenu = lazy(() => import("./NavbarMobileMenu"));
const NavbarTopupDialog = lazy(() => import("./NavbarTopupDialog"));

interface NavbarProps {
  onOpenProposeModal?: () => void;
}

export function Navbar({ onOpenProposeModal }: NavbarProps = {}) {
  const { user, profile, isAdmin, isModerator, signOut, refreshProfile } =
    useAuth();
  const { theme, toggleTheme } = useTheme();
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
              className="brand-logo-pill rounded-md px-2 py-[5px] text-[16px] font-black italic tracking-tight text-white leading-none transition hover:brightness-110"
            >
              BSPLIC 2.0
            </Link>
            <div className="hidden lg:flex items-center gap-4">
              <Link
                to="/"
                className={cn(
                  "text-[14px] font-semibold hover:text-navbar-foreground hover:brightness-110 transition-colors leading-none",
                  isActivePath("/")
                    ? "text-navbar-foreground"
                    : "text-navbar-foreground/60",
                )}
              >
                Zakłady
              </Link>
              <Link
                to="/casino"
                className={cn(
                  "text-[14px] font-semibold hover:text-navbar-foreground transition-colors leading-none",
                  isActivePath("/casino")
                    ? "text-navbar-foreground"
                    : "text-navbar-foreground/60",
                )}
              >
                Kasyno
              </Link>
              <Link
                to="/social"
                className={cn(
                  "text-[14px] font-semibold hover:text-navbar-foreground transition-colors leading-none",
                  isActivePath("/social")
                    ? "text-navbar-foreground"
                    : "text-navbar-foreground/60",
                )}
              >
                Social
              </Link>
              <Link
                to="/rankings"
                className={cn(
                  "text-[14px] font-semibold hover:text-navbar-foreground transition-colors leading-none",
                  isActivePath("/rankings")
                    ? "text-navbar-foreground"
                    : "text-navbar-foreground/60",
                )}
              >
                Rankingi
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={cn(
                    "inline-flex items-center gap-1 text-[14px] font-semibold leading-none hover:text-navbar-foreground transition-colors",
                    isActivePath("/admin")
                      ? "text-navbar-foreground"
                      : "text-navbar-foreground/60",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" /> Admin
                </Link>
              )}
              {!isAdmin && isModerator && (
                <Link
                  to="/admin"
                  className={cn(
                    "inline-flex items-center gap-1 text-[14px] font-semibold leading-none hover:text-navbar-foreground transition-colors",
                    isActivePath("/admin")
                      ? "text-navbar-foreground"
                      : "text-navbar-foreground/60",
                  )}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" /> Propozycje
                </Link>
              )}
            </div>
          </div>

          <div className="hidden lg:flex h-full items-center gap-3">
            {profile && isDesktopNav && (
              <button
                onClick={openTopupDialog}
                className="press-scale navbar-chip flex h-8 items-center gap-1.5 rounded-full py-0 pl-1 pr-3 text-[13px] font-bold leading-none text-primary-foreground transition-colors"
                title={
                  canTopup()
                    ? "Doładuj portfel"
                    : "Już doładowano dzisiaj. Wróć jutro!"
                }
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary">
                  <Plus className="h-4 w-4" strokeWidth={3} />
                </span>
                {Number(profile.balance).toFixed(2)} zł
              </button>
            )}
            {isDesktopNav && (
              <Suspense fallback={null}>
                <NotificationsBell
                  userId={user?.id}
                  className="h-8 w-8 p-0 [&>svg]:h-5 [&>svg]:w-5"
                />
              </Suspense>
            )}
            {profile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-8 items-center gap-2 text-[13px] font-medium leading-none text-primary-foreground transition hover:brightness-110 outline-none"
                    title="Menu użytkownika"
                  >
                    <Avatar className="h-7 w-7 bg-primary-foreground/20">
                      <AvatarImage
                        src={profile.avatar_url ?? undefined}
                        alt={`Avatar ${profile.username}`}
                      />
                      <AvatarFallback className="bg-primary-foreground/20 text-[11px] font-bold text-primary-foreground">
                        {profile.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{profile.username}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <UserRound className="mr-2 h-4 w-4" /> Profil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={toggleTheme}
                    className="cursor-pointer"
                  >
                    {theme === "dark" ? (
                      <Sun className="mr-2 h-4 w-4" />
                    ) : (
                      <Moon className="mr-2 h-4 w-4" />
                    )}
                    {theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Wyloguj
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="lg:hidden flex h-full items-center gap-2">
            {profile && !isDesktopNav && (
              <button
                onClick={openTopupDialog}
                className="press-scale navbar-chip flex h-8 items-center gap-1.5 rounded-full py-0 pl-1 pr-2.5 text-[12px] font-bold leading-none text-primary-foreground transition-colors"
                title={
                  canTopup()
                    ? "Doładuj portfel"
                    : "Już doładowano dzisiaj. Wróć jutro!"
                }
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full gradient-primary">
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {Number(profile.balance).toFixed(2)} zł
              </button>
            )}
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
              className="flex h-8 w-8 items-center justify-center text-primary-foreground/80 transition-colors hover:text-primary-foreground"
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
                  onOpenProposeModal={onOpenProposeModal}
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
