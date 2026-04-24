import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function CasinoHub() {
  return (
    <div className="mx-auto w-full max-w-7xl p-4 pb-10 pt-6 md:p-6 md:pb-14 space-y-8">

      <div className="text-center space-y-3">
        <h1 className="text-4xl font-black text-white uppercase tracking-wider drop-shadow-lg">
          Casino Hub
        </h1>
        <p className="text-white/60">Wybierz grę i spróbuj swojego szczęścia</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

        {/* Roulette Card */}
        <Link to="/casino/roulette" className="group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl aspect-video flex flex-col justify-end transition-colors group-hover:bg-white/[0.05]"
          >
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl group-hover:bg-amber-500/20 transition-colors" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-red-500/10 blur-3xl group-hover:bg-red-500/20 transition-colors" />

            <div className="relative z-10">
              <div className="h-16 w-16 mb-4 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-300 text-3xl">
                🎰
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Ruletka</h2>
              <p className="text-white/60 text-sm">Klasyczna ruletka z mnożnikami. Obstawiaj kolory, parzyste lub swoje szczęśliwe numery.</p>
            </div>
          </motion.div>
        </Link>

        {/* Blackjack Card */}
        <Link to="/casino/blackjack" className="group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl aspect-video flex flex-col justify-end transition-colors group-hover:bg-white/[0.05]"
          >
             <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition-colors" />
             <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl group-hover:bg-indigo-500/20 transition-colors" />

            <div className="relative z-10">
              <div className="flex gap-1 mb-4">
                 <div className="h-16 w-12 rounded-xl bg-white flex items-center justify-center text-black text-2xl font-black border-4 border-indigo-500/30 rotate-[-10deg]">
                    A♠
                 </div>
                 <div className="h-16 w-12 rounded-xl bg-white flex items-center justify-center text-red-600 text-2xl font-black border-4 border-indigo-500/30 rotate-[10deg] translate-y-2 -translate-x-2">
                    J♥
                 </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Blackjack</h2>
              <p className="text-white/60 text-sm">Zagraj przeciwko krupierowi. Dobieraj karty, podwajaj stawki i zbierz 21 punktów.</p>
            </div>
          </motion.div>
        </Link>

      </div>
    </div>
  );
}
