import { LiquidGlassMobileBottomNav } from "@/components/LiquidGlassMobileBottomNav";

interface AppMobileBottomNavProps {
  hidden?: boolean;
}

export function AppMobileBottomNav({ hidden = false }: AppMobileBottomNavProps) {
  return <LiquidGlassMobileBottomNav hidden={hidden} />;
}
