import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function CasinoHub() {
  return (
    <div
      data-testid="casino-hub-page"
      className="relative mx-auto min-h-full w-full overflow-hidden bg-cover bg-center bg-no-repeat p-4 pb-10 pt-6 md:p-6 md:pb-14"
      style={{ backgroundImage: "url('/casino/hub-image.webp')" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_34%),linear-gradient(180deg,rgba(10,5,8,0.54),rgba(5,4,7,0.92)_58%,rgba(5,4,7,0.98))]" />
      <div className="relative z-10 mx-auto w-full max-w-7xl space-y-8">
        <div className="space-y-3 pt-4 text-center md:pt-10">
          <h1 className="text-4xl font-black uppercase tracking-wider text-white drop-shadow-lg md:text-6xl">
            Casino Hub
          </h1>
          <p className="mx-auto max-w-xl text-sm text-white/70 md:text-base">
            Wybierz grę i spróbuj swojego szczęścia
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          <Link to="/casino/roulette" className="group">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative flex min-h-[320px] overflow-hidden rounded-3xl border border-amber-300/20 bg-black/30 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl transition-colors md:aspect-[4/5] md:min-h-[460px] lg:aspect-[16/11] lg:min-h-[120px]"
            >
              <div
                data-testid="casino-roulette-card-art"
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 ease-out md:bg-[center_center]"
                style={{
                  backgroundImage: "url('/casino/roulette-button.webp')",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/48 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.28),transparent_54%)]" />

              <div className="relative z-10 mt-auto max-w-sm">
                <h2 className="mb-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                  Ruletka
                </h2>
                <p className="text-sm leading-relaxed text-white">
                  Klasyczna ruletka z mnożnikami. Obstawiaj kolory, parzyste lub
                  swoje szczęśliwe numery.
                </p>
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
                className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-700 ease-out md:bg-[center_center]"
                style={{
                  backgroundImage: "url('/casino/blackjack-button.webp')",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.24),transparent_54%)]" />

              <div className="relative z-10 mt-auto max-w-sm">
                <h2 className="mb-1 text-3xl font-black tracking-tight text-white md:text-4xl">
                  Blackjack
                </h2>
                <p className="text-sm leading-relaxed text-white">
                  Zagraj przeciwko krupierowi. Dobieraj karty, podwajaj stawki i
                  zbierz 21 punktów.
                </p>
              </div>
            </motion.div>
          </Link>
        </div>
      </div>
    </div>
  );
}
