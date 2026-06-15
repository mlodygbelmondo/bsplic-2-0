import type { Theme } from "@/contexts/ThemeContext";

export type MobileBottomNavTone = "default" | "casino";

const BASE_SURFACE_CLASS_NAME =
  "rounded-t-lg border-t px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-xl";

const LIGHT_SURFACE_CLASS_NAME =
  "border-black/5 bg-white/72 text-slate-950 shadow-[0_-14px_36px_rgba(15,23,42,0.13),inset_0_1px_0_rgba(255,255,255,0.86)] supports-[backdrop-filter]:bg-white/68";

const CASINO_SURFACE_CLASS_NAME =
  "border-white/10 bg-zinc-950/86 text-white shadow-[0_-18px_42px_rgba(0,0,0,0.38)] supports-[backdrop-filter]:bg-zinc-950/76";

const DARK_SURFACE_CLASS_NAME =
  "border-[#ff335f]/15 bg-[#16070d]/90 text-white shadow-[0_-18px_44px_rgba(80,0,28,0.42)] supports-[backdrop-filter]:bg-[#16070d]/80";

export function getMobileBottomNavUnderlayClassName(
  theme: Theme,
  tone: MobileBottomNavTone = "default",
) {
  return theme === "light" && tone === "default"
    ? "rounded-t-lg bg-white"
    : "rounded-t-lg";
}

export function getMobileBottomNavSurfaceClassName(
  theme: Theme,
  tone: MobileBottomNavTone = "default",
) {
  if (theme === "dark") {
    return `${BASE_SURFACE_CLASS_NAME} ${DARK_SURFACE_CLASS_NAME}`;
  }

  if (tone === "casino") {
    return `${BASE_SURFACE_CLASS_NAME} ${CASINO_SURFACE_CLASS_NAME}`;
  }

  return `${BASE_SURFACE_CLASS_NAME} ${LIGHT_SURFACE_CLASS_NAME}`;
}

export function getMobileBottomNavActiveClassName(
  theme: Theme,
  tone: MobileBottomNavTone = "default",
) {
  return theme === "dark" || tone === "casino"
    ? "text-[#ffe14a]"
    : "text-[#eab308]";
}

export function getMobileBottomNavInactiveClassName(
  theme: Theme,
  tone: MobileBottomNavTone = "default",
) {
  return theme === "dark" || tone === "casino"
    ? "text-white/68 hover:text-white"
    : "text-slate-900/62 hover:text-slate-950";
}
