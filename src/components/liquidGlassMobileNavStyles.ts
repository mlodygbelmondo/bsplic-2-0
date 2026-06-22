import type { CSSProperties } from "react";

import type { Theme } from "@/contexts/ThemeContext";
import type { MobileBottomNavTone } from "@/components/mobileBottomNavStyles";

export const LIQUID_GLASS_MOBILE_NAV_STYLE: CSSProperties = {
  position: "absolute",
  top: "50%",
  left: "50%",
  width: "100%",
};

export const LIQUID_GLASS_MOBILE_NAV_ITEM_CLASS_NAME =
  "relative z-10 flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-[1.35rem] px-1 text-[12px] leading-none transition-[background-color,box-shadow,color,transform] duration-200";

export function getLiquidGlassMobileNavShellClassName(
  theme: Theme,
  tone: MobileBottomNavTone,
) {
  if (theme === "dark") {
    return "bg-[#170811]/[0.88] shadow-[0_-12px_42px_rgba(80,0,28,0.48),inset_0_1px_0_rgba(255,255,255,0.16)]";
  }

  if (tone === "casino") {
    return "bg-zinc-950/[0.84] shadow-[0_-16px_46px_rgba(0,0,0,0.44),inset_0_1px_0_rgba(255,255,255,0.13)]";
  }

  return "bg-white/[0.86] shadow-[0_-12px_38px_rgba(15,23,42,0.16),0_-4px_24px_rgba(230,0,26,0.08),inset_0_1px_0_rgba(255,255,255,0.95)]";
}

export function getLiquidGlassMobileNavBorderClassName(
  theme: Theme,
  tone: MobileBottomNavTone,
) {
  if (theme === "dark") {
    return "border-white/[0.12] ring-[#ff335f]/[0.12]";
  }

  if (tone === "casino") {
    return "border-white/[0.12] ring-white/[0.10]";
  }

  return "border-white/[0.78] ring-[#e6001a]/[0.16]";
}

export function getLiquidGlassMobileNavActiveItemClassName(
  theme: Theme,
  tone: MobileBottomNavTone,
) {
  if (theme === "dark") {
    return "text-[#ffe14a] bg-white/[0.11] shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_10px_24px_rgba(255,225,74,0.18),inset_0_1px_0_rgba(255,255,255,0.28)]";
  }

  if (tone === "casino") {
    return "text-[#ffe14a] bg-white/[0.13] shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_10px_24px_rgba(255,225,74,0.16),inset_0_1px_0_rgba(255,255,255,0.24)]";
  }

  return "text-[#c90018] bg-[#c90018]/[0.10] shadow-[0_0_0_1px_rgba(201,0,24,0.12),inset_0_1px_0_rgba(255,255,255,0.92)]";
}

export function getLiquidGlassMobileNavInactiveItemClassName(
  theme: Theme,
  tone: MobileBottomNavTone,
) {
  return theme === "dark" || tone === "casino"
    ? "font-medium text-white/[0.68] hover:text-white"
    : "font-medium text-slate-950/[0.82] hover:text-slate-950";
}

export function getLiquidGlassMobileNavLabelClassName(
  theme: Theme,
  tone: MobileBottomNavTone,
  active: boolean,
) {
  if (theme === "dark" || tone === "casino") {
    return "[text-shadow:none]";
  }

  if (active) {
    return "rounded-full bg-transparent px-1 py-0.5 shadow-none [text-shadow:none]";
  }

  return "rounded-full bg-white/[0.78] px-1 py-0.5 shadow-none [text-shadow:none]";
}
