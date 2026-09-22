import { useBootHold, useBootSplashVisible } from "@/hooks/useBootSplash";

// Full-screen fallback for auth and route loading. While the boot splash is
// up it only keeps the splash from lifting, so boot shows one continuous
// loader. Afterwards it shows a spinner that appears only if loading takes
// long enough to notice.
export function BrandedLoader() {
  useBootHold();
  const bootSplashVisible = useBootSplashVisible();

  if (bootSplashVisible) {
    return <div className="min-safe-screen bg-[#0f0e16]" aria-hidden="true" />;
  }

  return (
    <div
      role="status"
      aria-label="Ładowanie"
      className="min-safe-screen flex items-center justify-center bg-background"
    >
      <span className="brand-loader-delayed" aria-hidden="true">
        <span className="brand-spinner block" />
      </span>
    </div>
  );
}
