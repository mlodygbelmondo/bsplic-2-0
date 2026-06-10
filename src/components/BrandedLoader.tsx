export function BrandedLoader() {
  return (
    <div className="min-safe-screen gradient-primary flex flex-col items-center justify-center gap-5">
      <div className="brand-logo-pill rounded-lg px-4 py-2.5 text-2xl font-black italic tracking-tight text-white leading-none animate-pulse">
        BSPLIC 2.0
      </div>
      <div
        className="h-1 w-36 overflow-hidden rounded-full bg-white/20"
        role="status"
        aria-label="Ładowanie"
      >
        <div className="loader-bar-slide h-full w-1/3 rounded-full bg-white/80" />
      </div>
    </div>
  );
}
