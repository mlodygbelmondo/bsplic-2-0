import { Link, useLocation } from "react-router-dom";
import {
  CircleDot,
  Club,
  House,
  MessageCircle,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  getMobileBottomNavActiveClassName,
  getMobileBottomNavInactiveClassName,
  getMobileBottomNavSurfaceClassName,
  getMobileBottomNavUnderlayClassName,
} from "@/components/mobileBottomNavStyles";

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
    icon: House,
    isActive: (pathname) => pathname === "/",
  },
  {
    to: "/social",
    label: "Social",
    icon: MessageCircle,
    isActive: (pathname) => pathname.startsWith("/social"),
  },
  {
    to: "/casino/roulette",
    label: "Ruletka",
    icon: CircleDot,
    isActive: (pathname) => pathname.startsWith("/casino/roulette"),
  },
  {
    to: "/casino/blackjack",
    label: "Blackjack",
    icon: Club,
    isActive: (pathname) => pathname.startsWith("/casino/blackjack"),
  },
  {
    to: "/rankings",
    label: "Rankingi",
    icon: Trophy,
    isActive: (pathname) => pathname.startsWith("/rankings"),
  },
];

const GLASS_ITEM_CLASS_NAME =
  "flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-black transition-colors";

export function AppMobileBottomNav({ hidden = false }: AppMobileBottomNavProps) {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const tone = pathname.startsWith("/casino") ? "casino" : "default";
  const activeClassName = getMobileBottomNavActiveClassName(theme, tone);
  const inactiveClassName = getMobileBottomNavInactiveClassName(theme, tone);

  return (
    <nav
      aria-label="Nawigacja aplikacji"
      className={cn(
        "lg:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none transition-[transform,opacity] duration-200 ease-out will-change-transform",
        hidden ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
      )}
    >
      <div
        className={cn(
          "pointer-events-auto",
          getMobileBottomNavUnderlayClassName(theme, tone),
        )}
      >
        <div
          className={cn(
            "grid grid-cols-5",
            getMobileBottomNavSurfaceClassName(theme, tone),
          )}
        >
          {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon, isActive }) => {
            const active = isActive(pathname);

            return (
              <Link
                key={label}
                to={to}
                aria-label={label}
                tabIndex={hidden ? -1 : undefined}
                className={cn(
                  GLASS_ITEM_CLASS_NAME,
                  active ? activeClassName : inactiveClassName,
                )}
              >
                <Icon
                  className="h-5 w-5 shrink-0"
                  strokeWidth={active ? 2.6 : 2.2}
                />
                <span
                  className={cn(
                    "w-full truncate text-center leading-none",
                    active && "font-semibold",
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
