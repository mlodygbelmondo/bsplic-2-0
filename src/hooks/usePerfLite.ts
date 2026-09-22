import { useSyncExternalStore } from "react";
import { isPerfLite, subscribePerfMode } from "@/lib/perf-mode";

export function usePerfLite() {
  return useSyncExternalStore(subscribePerfMode, isPerfLite, () => false);
}
