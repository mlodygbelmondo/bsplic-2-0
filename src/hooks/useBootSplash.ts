import { useEffect, useSyncExternalStore } from "react";
import {
  holdBoot,
  isBootSplashVisible,
  subscribeBootSplash,
} from "@/lib/boot/boot-splash";

/** Keeps the boot splash up while `active` is true; harmless once it is gone. */
export function useBootHold(active = true) {
  useEffect(() => {
    if (!active) return;
    return holdBoot();
  }, [active]);
}

export function useBootSplashVisible() {
  return useSyncExternalStore(
    subscribeBootSplash,
    isBootSplashVisible,
    () => false,
  );
}
