import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";

type CasinoBackgroundStyle = CSSProperties & {
  "--casino-bg-desktop": string;
  "--casino-bg-mobile": string;
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
          {[
            {
              id: "bandit",
              title: "Midnight Bandit",
            },
            {
              id: "candy",
              title: "Candy Cascade",
            },
          ].map((game) => (
            <Link
              key={game.id}
              to={`/casino/slots/${game.id}`}
              className="group relative flex min-h-[290px] overflow-hidden rounded-3xl border border-amber-200/30 bg-black md:min-h-[380px]"
            >
              <img
                src={`/casino/slots/${game.id}.webp`}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[center_30%] transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
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

          <Link to="/casino/roulette" className="group">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative flex min-h-[320px] overflow-hidden rounded-3xl border border-amber-300/20 bg-black/30 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl transition-colors md:aspect-[4/5] md:min-h-[460px] lg:aspect-[16/11] lg:min-h-[120px]"
            >
              <div
                data-testid="casino-roulette-card-art"
                className="casino-responsive-bg absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 ease-out md:bg-[center_center]"
                style={getCasinoBackgroundStyle(
                  "/casino/roulette-button.webp",
                  "/casino/roulette-button.webp",
                )}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/48 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.28),transparent_54%)]" />

              <div className="relative z-10 mt-auto max-w-sm">
                <h2 className="mb-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                  Ruletka
                </h2>
                <span className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur text-white">Zagraj →</span>
              </div>
            </motion.div>
          </Link>

          <Link to="/casino/blackjack" className="group">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative flex min-h-[320px] overflow-hidden rounded-3xl border border-sky-200/20 bg-black/30 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl transition-colors md:aspect-[4/5] md:min-h-[460px] lg:aspect-[16/11] lg:min-h-[120px]"
            >
              <div
                data-testid="casino-blackjack-card-art"
                className="casino-responsive-bg absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 ease-out md:bg-[center_center]"
                style={getCasinoBackgroundStyle(
                  "/casino/blackjack-button.webp",
                  "/casino/blackjack-button.webp",
                )}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.24),transparent_54%)]" />

              <div className="relative z-10 mt-auto max-w-sm">
                <h2 className="mb-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                  Blackjack
                </h2>
                <span className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur text-white">Zagraj →</span>
              </div>
            </motion.div>
          </Link>
        </div>
      </div>
    </div>
  );
}
