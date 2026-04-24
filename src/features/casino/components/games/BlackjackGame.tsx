import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useBlackjack, calculateHandValue } from '@/features/casino/hooks/useBlackjack';
import { PlayingCard } from './PlayingCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function BlackjackGame() {
  const { user, profile, refreshProfile } = useAuth();
  const [betInput, setBetInput] = useState('10');

  const {
    playerHand,
    dealerHand,
    status,
    stake,
    isDealing,
    startGame,
    hit,
    stand,
    doubleDown,
    resetGame,
    canDoubleDown,
  } = useBlackjack({
    userId: user?.id ?? '',
    refreshProfile,
  });

  if (!user || !profile) return null;

  const playerValue = calculateHandValue(playerHand);
  const dealerValue = status === 'playing' ? calculateHandValue(dealerHand.slice(0, 1)) : calculateHandValue(dealerHand);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 min-h-[600px] flex flex-col justify-center pb-20 pt-10">

      {/* Dealer Area */}
      <div className="flex flex-col items-center space-y-4 min-h-[220px]">
        {dealerHand.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
            <span className="bg-black/50 text-white/80 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
              Krupier: {dealerValue}
            </span>
            <div className="flex -space-x-8 sm:-space-x-12">
              {dealerHand.map((card, i) => (
                <PlayingCard key={`dealer-${i}`} card={card} hidden={status === 'playing' && i === 1} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Center Action/Result Area */}
      <div className="flex flex-col items-center justify-center min-h-[120px]">
        <AnimatePresence mode="wait">
          {status === 'betting' && (
            <motion.div
              key="betting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-4 bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-md"
            >
              <h2 className="text-xl font-bold text-white">Postaw zakład</h2>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={betInput}
                  onChange={(e) => setBetInput(e.target.value)}
                  className="w-32 bg-black/40 border-white/20 text-white text-center text-lg h-12 rounded-xl"
                  min="1"
                  step="1"
                />
                <Button
                  onClick={() => startGame(Number(betInput))}
                  disabled={isDealing || Number(betInput) <= 0 || Number(betInput) > Number(profile.balance)}
                  className="h-12 px-8 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-black"
                >
                  Graj
                </Button>
              </div>
              <p className="text-sm text-white/50">Saldo: {Number(profile.balance).toFixed(2)} zł</p>
            </motion.div>
          )}

          {['won', 'lost', 'push'].includes(status) && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <h2 className={`text-4xl sm:text-5xl font-black uppercase tracking-wider ${
                status === 'won' ? 'text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]' :
                status === 'lost' ? 'text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.5)]' :
                'text-gray-300 drop-shadow-[0_0_15px_rgba(209,213,219,0.5)]'
              }`}>
                {status === 'won' ? 'Wygrana!' : status === 'lost' ? 'Porażka' : 'Remis'}
              </h2>
              <Button onClick={resetGame} variant="outline" className="mt-2 bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl px-8">
                Graj ponownie
              </Button>
            </motion.div>
          )}

          {status === 'playing' && (
             <motion.div
              key="playing-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
             >
               <Button onClick={hit} variant="secondary" className="h-14 px-8 text-lg rounded-2xl bg-white/10 text-white hover:bg-white/20 border border-white/20">
                 Dobierz (Hit)
               </Button>
               <Button onClick={stand} className="h-14 px-8 text-lg rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-bold">
                 Czekaj (Stand)
               </Button>
               {canDoubleDown && (
                 <Button
                   onClick={doubleDown}
                   variant="outline"
                   disabled={stake > Number(profile.balance)}
                   className="h-14 px-6 text-lg rounded-2xl bg-blue-500/20 text-blue-300 border-blue-500/50 hover:bg-blue-500/30"
                 >
                   x2
                 </Button>
               )}
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player Area */}
      <div className="flex flex-col items-center space-y-4 min-h-[220px]">
        {playerHand.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2">
            <div className="flex -space-x-8 sm:-space-x-12 relative z-10">
              {playerHand.map((card, i) => (
                <PlayingCard key={`player-${i}`} card={card} />
              ))}
            </div>
            <span className={`px-4 py-1.5 rounded-full text-base font-bold backdrop-blur-md border border-white/10 ${
                playerValue > 21 ? 'bg-red-500/80 text-white' :
                playerValue === 21 ? 'bg-green-500/80 text-white' : 'bg-black/50 text-white/90'
            }`}>
              Ty: {playerValue}
            </span>
            <span className="text-white/40 text-sm mt-1">Stawka: {stake.toFixed(2)} zł</span>
          </motion.div>
        )}
      </div>

    </div>
  );
}
