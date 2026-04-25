import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

import type { RouletteRoundParticipant } from '@/types/database';

interface RoundParticipantsListProps {
  participants: RouletteRoundParticipant[];
}

export function RoundParticipantsList({ participants }: RoundParticipantsListProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.18 }}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
            Gracze w rundzie
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/50">
          {participants.length}
        </span>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-white/45">
          Pierwszy zakład otworzy listę graczy tej rundy.
        </p>
      ) : (
        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.user_id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-amber-500/10 text-xs font-bold text-amber-200">
                  {participant.avatar_url ? (
                    <img
                      src={participant.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    participant.username.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {participant.username}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-white/35">
                    {participant.bet_count}{' '}
                    {participant.bet_count === 1 ? 'zakład' : 'zakłady'}
                  </p>
                </div>
              </div>
              <span className="flex-shrink-0 font-mono text-sm font-bold text-amber-200">
                {participant.total_stake.toFixed(2)} zł
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
