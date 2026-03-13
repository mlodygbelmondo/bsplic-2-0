export function HomePromoBanner() {
  return (
    <section className="gradient-banner rounded-xl p-4 flex items-center justify-between overflow-hidden relative card-shadow shrink-0">
      <div className="relative z-10">
        <p className="text-primary-foreground/80 text-[11px] font-medium uppercase tracking-wider">Promocja</p>
        <h2 className="text-primary-foreground text-xl font-black">Multiboost 400%</h2>
        <p className="text-primary-foreground/70 text-[12px] mt-0.5">Wygrywaj jeszcze więcej — z Multiboost i bez podatku</p>
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20" aria-hidden="true">
        <div className="text-[80px]">🏆</div>
      </div>
    </section>
  );
}
