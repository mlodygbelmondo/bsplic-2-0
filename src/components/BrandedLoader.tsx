// Mirrors the inline PWA splash from index.html (same splash-* classes) so
// the handoff from the static splash to this loader is seamless.
export function BrandedLoader() {
  return (
    <div className="min-safe-screen relative flex flex-col items-center justify-center overflow-hidden bg-[#0f0e16]">
      <div className="splash-aurora splash-aurora-red" aria-hidden="true" />
      <div className="splash-aurora splash-aurora-gold" aria-hidden="true" />
      <div className="splash-center" role="status" aria-label="Ładowanie">
        <div className="splash-wordmark">BSPLIC&nbsp;2.0</div>
        <div className="splash-track">
          <div className="splash-bar" />
        </div>
      </div>
    </div>
  );
}
