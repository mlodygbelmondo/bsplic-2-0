import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { SLOT_GAMES } from "@/features/slots/model";
import { usePageTitle } from "@/hooks/usePageTitle";

type CasinoBackgroundStyle = CSSProperties & {
  "--casino-bg-desktop": string;
  "--casino-bg-mobile": string;
};

type SlotCardSymbolStyle = CSSProperties & {
  "--slot-symbol-sheet": string;
  "--slot-symbol-position": string;
};

function getCasinoBackgroundStyle(
  desktopImage: string,
  mobileImage: string,
): CasinoBackgroundStyle {
  return {
    "--casino-bg-desktop": `url('${desktopImage}')`,
    "--casino-bg-mobile": `url('${mobileImage}')`,
  };
}

function getSlotCardSymbolStyle(gameId: string, index: number): SlotCardSymbolStyle {
  const game = SLOT_GAMES[gameId as keyof typeof SLOT_GAMES];
  const globalIndex = game.offset + index;
  const sheet =
    globalIndex >= 16
      ? "/casino/slots/symbols-forge-tide.webp"
      : "/casino/slots/symbols.webp";
  const spriteIndex = globalIndex % 16;

  return {
    "--slot-symbol-sheet": `url('${sheet}')`,
    "--slot-symbol-position": `${((spriteIndex % 4) * 100) / 3}% ${
      (Math.floor(spriteIndex / 4) * 100) / 3
    }%`,
  };
}

export default function CasinoHub() {
  usePageTitle("Kasyno");
  return (
    <div
      data-testid="casino-hub-page"
      className="casino-responsive-bg relative mx-auto min-h-full w-full overflow-hidden bg-cover bg-center bg-no-repeat p-4 pb-[var(--mobile-bottom-nav-scroll-padding)] pt-6 md:px-6"
      style={getCasinoBackgroundStyle(
        "/casino/hub-image.webp",
        "/casino/hub-mobile-background.webp",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_34%),linear-gradient(180deg,rgba(10,5,8,0.54),rgba(5,4,7,0.92)_58%,rgba(5,4,7,0.98))]" />
      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3 pt-4 text-center md:pt-10">
          <h1 className="text-4xl font-black uppercase tracking-wider text-white drop-shadow-lg md:text-6xl">
            Wybierz grę
          </h1>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          {Object.entries(SLOT_GAMES).map(([id, game]) => (
            <Link
              key={id}
              to={`/casino/slots/${id}`}
              className="group relative flex min-h-[290px] overflow-hidden rounded-3xl border border-amber-200/30 bg-black md:min-h-[380px]"
              data-slot-card={id}
            >
              <img
                src={game.image}
                loading="lazy"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[center_30%] transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
              <div className="pointer-events-none absolute inset-x-[12%] top-[24%] flex items-center justify-center gap-3 opacity-90 transition-transform duration-500 group-hover:scale-105 sm:top-[22%]">
                {[1, 2, 6].map((symbol, index) => (
                  <span
                    key={symbol}
                    className="slot-lobby-symbol"
                    data-size={index === 1 ? "large" : "small"}
                    style={getSlotCardSymbolStyle(id, symbol)}
                  />
                ))}
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.72)_78%,rgba(0,0,0,0.92))]" />
              <div className="relative mt-auto p-6 text-white">
                <h2 className="mb-2 font-serif text-4xl font-black tracking-tight">
                  {game.title}
                </h2>
                <span className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur">
                  Zagraj →
                </span>
              </div>
            </Link>
          ))}

          {[
            { id: "roulette", title: "Ruletka", image: "/casino/roulette-cover.webp" },
            { id: "blackjack", title: "Blackjack", image: "/casino/blackjack-cover.webp" },
          ].map((game) => (
            <Link
              key={game.id}
              to={`/casino/${game.id}`}
              className="group relative flex min-h-[290px] overflow-hidden rounded-2xl border border-amber-200/30 bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 md:min-h-[380px]"
            >
              <img
                data-testid={`casino-${game.id}-card-art`}
                src={game.image}
                loading="lazy"
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[center_35%] transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
              <div className="relative mt-auto p-6 text-white">
                <h2 className="mb-2 font-serif text-4xl font-black tracking-tight">{game.title}</h2>
                <span className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold">Zagraj →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
