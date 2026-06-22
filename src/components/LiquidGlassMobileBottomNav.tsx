import LiquidGlass from "liquid-glass-react";
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
  getLiquidGlassMobileNavActiveItemClassName,
  getLiquidGlassMobileNavBorderClassName,
  getLiquidGlassMobileNavInactiveItemClassName,
  getLiquidGlassMobileNavLabelClassName,
  getLiquidGlassMobileNavShellClassName,
  LIQUID_GLASS_MOBILE_NAV_ITEM_CLASS_NAME,
  LIQUID_GLASS_MOBILE_NAV_STYLE,
} from "@/components/liquidGlassMobileNavStyles";

interface LiquidGlassMobileBottomNavProps {
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

export function LiquidGlassMobileBottomNav({
  hidden = false,
}: LiquidGlassMobileBottomNavProps) {
  const { pathname } = useLocation();
  const { theme } = useTheme();
  const tone = pathname.startsWith("/casino") ? "casino" : "default";

  return (
    <nav
      aria-label="Nawigacja aplikacji"
      className={cn(
        "lg:hidden fixed inset-x-0 bottom-0 z-50 pointer-events-none px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] transition-transform duration-200 ease-out will-change-transform opacity-100",
        hidden ? "translate-y-full" : "translate-y-0",
      )}
    >
      <div className="pointer-events-none relative mx-auto h-[72px] w-full max-w-[430px]">
        <LiquidGlass
          displacementScale={46}
          blurAmount={0.035}
          saturation={152}
          aberrationIntensity={1.35}
          elasticity={0.04}
          cornerRadius={28}
          padding="0px"
          overLight={false}
          mode="standard"
          className="pointer-events-none w-full"
          style={LIQUID_GLASS_MOBILE_NAV_STYLE}
        >
          <div
            aria-hidden="true"
            className={cn(
              "h-[72px] w-[calc(100vw-1rem)] max-w-[430px] overflow-hidden rounded-[1.75rem] border ring-1 backdrop-blur-2xl",
              getLiquidGlassMobileNavShellClassName(theme, tone),
              getLiquidGlassMobileNavBorderClassName(theme, tone),
            )}
          />
        </LiquidGlass>

        <div
          data-testid="mobile-bottom-nav-items"
          className="pointer-events-auto absolute inset-0 grid h-[72px] w-[calc(100vw-1rem)] max-w-[430px] grid-cols-5 items-center px-1.5 py-1.5"
        >
          {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon, isActive }) => {
            const active = isActive(pathname);

            return (
              <Link
                key={label}
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
                tabIndex={hidden ? -1 : undefined}
                className={cn(
                  LIQUID_GLASS_MOBILE_NAV_ITEM_CLASS_NAME,
                  active
                    ? cn(
                        "font-bold",
                        getLiquidGlassMobileNavActiveItemClassName(theme, tone),
                      )
                    : getLiquidGlassMobileNavInactiveItemClassName(theme, tone),
                )}
              >
                <Icon
                  className="h-5 w-5 shrink-0"
                  strokeWidth={active ? 2.4 : 2}
                />
                <span
                  className={cn(
                    "box-border max-w-full truncate text-center leading-[1.15]",
                    getLiquidGlassMobileNavLabelClassName(theme, tone),
                    active && "font-bold",
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
