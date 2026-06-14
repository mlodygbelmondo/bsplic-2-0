import { Link, useLocation } from "react-router-dom";
import {
  Club,
  Spade,
  Ticket,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface AppMobileBottomNavProps {
  hidden?: boolean;
}

interface MobileNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    to: "/",
    label: "Zakłady",
    icon: Ticket,
    isActive: (pathname) => pathname === "/",
  },
  {
    to: "/casino",
    label: "Poker",
    icon: Spade,
    isActive: (pathname) =>
      pathname === "/casino" || pathname.startsWith("/casino/roulette"),
  },
  {
    to: "/casino/blackjack",
    label: "Blackjack",
    icon: Club,
    isActive: (pathname) => pathname.startsWith("/casino/blackjack"),
  },
  {
    to: "/social",
    label: "Social",
    icon: UsersRound,
    isActive: (pathname) => pathname.startsWith("/social"),
  },
  {
    to: "/rankings",
    label: "Rankingi",
    icon: Trophy,
    isActive: (pathname) => pathname.startsWith("/rankings"),
  },
];

export function AppMobileBottomNav({ hidden = false }: AppMobileBottomNavProps) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Nawigacja aplikacji"
      className={cn(
        "lg:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none transition-[transform,opacity] duration-200 ease-out will-change-transform",
        hidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      <div className="grid grid-cols-5 rounded-t-lg bg-card/95 backdrop-blur-md border-t border-border/60 shadow-[0_-6px_18px_rgba(15,23,42,0.12)] px-3.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pointer-events-auto">
        {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon, isActive }) => {
          const active = isActive(pathname);

          return (
            <Link
              key={label}
              to={to}
              aria-label={label}
              tabIndex={hidden ? -1 : undefined}
              className={cn(
                "flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-2 rounded-md px-1 py-1 transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-[23px] w-[23px] shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={cn(
                  "w-full truncate text-center text-[10px] font-medium leading-none",
                  active && "font-semibold",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
