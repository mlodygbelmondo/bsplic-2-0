import { jackpotAudio } from './jackpotAudio';

const CONFETTI_COLORS = ['#fbbf24', '#f59e0b', '#dc2626', '#ffffff'];
const CONFETTI_Z_INDEX = 99999;

/**
 * Plays the reveal sound for everyone. Only the winner gets the fanfare and
 * confetti, so watching someone else's win stays low-key.
 */
export function celebrateJackpotReveal({
  isCurrentUserWinner,
  reducedMotion,
}: {
  isCurrentUserWinner: boolean;
  reducedMotion: boolean;
}) {
  jackpotAudio.playTicketPop();
  jackpotAudio.playGoldenChime();

  if (!isCurrentUserWinner) {
    return;
  }

  jackpotAudio.playImpact(0.4);
  window.setTimeout(() => jackpotAudio.playFanfare(), 180);

  if (reducedMotion) {
    return;
  }

  void import('canvas-confetti')
    .then(({ default: confetti }) => {
      void confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.55 },
        colors: CONFETTI_COLORS,
        zIndex: CONFETTI_Z_INDEX,
        disableForReducedMotion: true,
      });

      window.setTimeout(() => {
        for (const side of [
          { angle: 60, x: 0.08 },
          { angle: 120, x: 0.92 },
        ]) {
          void confetti({
            particleCount: 80,
            angle: side.angle,
            spread: 75,
            origin: { x: side.x, y: 0.65 },
            colors: CONFETTI_COLORS.slice(0, 3),
            zIndex: CONFETTI_Z_INDEX,
            disableForReducedMotion: true,
          });
        }
      }, 160);
    })
    .catch(() => undefined);
}
