import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { jackpotAudio } from '../lib/jackpotAudio';

const FACE_COUNT = 12;
const FACE_ANGLE = 360 / FACE_COUNT;
const FULL_TURNS = 6;
const WINNER_FACE_SWAP_ANGLE = 180;

type CylinderPhase = 'intro' | 'drawing' | 'revealed';

interface JackpotCylinderStageProps {
  phase: CylinderPhase;
  ticketNumbers: number[];
  winningTicketNumber: number | null;
  winnerTicketLabel: string;
  spinDurationMs: number;
  reducedMotion: boolean;
}

function formatFaceLabel(ticketNumber: number | null) {
  return ticketNumber === null
    ? '?'
    : `#${String(ticketNumber).padStart(2, '0')}`;
}

/**
 * Face 0 is the one that lands under the laser, so it carries the winner.
 * The other faces show real tickets from the pool, spread evenly when the
 * pool has more tickets than the drum has faces.
 */
function pickOtherFaceTickets(
  ticketNumbers: number[],
  winningTicketNumber: number | null,
) {
  const slots = FACE_COUNT - 1;
  const otherTickets = ticketNumbers.filter(
    (ticketNumber) => ticketNumber !== winningTicketNumber,
  );
  const source = otherTickets.length > 0 ? otherTickets : ticketNumbers;

  if (source.length === 0) {
    return Array.from({ length: slots }, () => null);
  }

  const stride = source.length > slots ? source.length / slots : 1;

  return Array.from(
    { length: slots },
    (_, index) => source[Math.floor(index * stride) % source.length],
  );
}

export function JackpotCylinderStage({
  phase,
  ticketNumbers,
  winningTicketNumber,
  winnerTicketLabel,
  spinDurationMs,
  reducedMotion,
}: JackpotCylinderStageProps) {
  const drumRef = useRef<HTMLDivElement>(null);
  const [showWinnerFace, setShowWinnerFace] = useState(phase === 'revealed');
  const [landed, setLanded] = useState(phase === 'revealed');

  // Until the winner face is shown, keep the winner among the other faces too;
  // leaving it out would hint at the result in small pools.
  const hiddenFromOtherFaces = showWinnerFace ? winningTicketNumber : null;
  const otherFaceTickets = useMemo(
    () => pickOtherFaceTickets(ticketNumbers, hiddenFromOtherFaces),
    [ticketNumbers, hiddenFromOtherFaces],
  );

  useEffect(() => {
    const drum = drumRef.current;
    const setAngle = (angle: number) => {
      if (drum) {
        drum.style.transform = `rotateX(${angle}deg)`;
      }
    };

    if (phase === 'intro') {
      setAngle(0);
      setShowWinnerFace(false);
      setLanded(false);
      return undefined;
    }

    if (phase === 'revealed' || reducedMotion) {
      setAngle(0);
      setShowWinnerFace(true);
      setLanded(true);
      return undefined;
    }

    setShowWinnerFace(false);
    setLanded(false);

    const totalAngle = FULL_TURNS * 360;
    let startTime: number | null = null;
    let lastFaceStep = 0;
    let winnerFaceShown = false;
    let frameId = 0;

    const step = (now: number) => {
      startTime ??= now;
      const progress = Math.min((now - startTime) / spinDurationMs, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3.8);
      const angle = easedProgress * totalAngle;
      setAngle(angle);

      // Swap the "?" for the winner once face 0 has rotated out of view.
      if (!winnerFaceShown && angle >= WINNER_FACE_SWAP_ANGLE) {
        winnerFaceShown = true;
        setShowWinnerFace(true);
      }

      const faceStep = Math.floor((angle + FACE_ANGLE / 2) / FACE_ANGLE);
      if (faceStep > lastFaceStep) {
        lastFaceStep = faceStep;
        jackpotAudio.playTick(820 - progress * 340, 0.025, 0.12);
      }

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
        return;
      }

      setShowWinnerFace(true);
      setLanded(true);
    };

    frameId = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(frameId);
  }, [phase, reducedMotion, spinDurationMs]);

  const winnerFaceLabel = formatFaceLabel(
    showWinnerFace ? winningTicketNumber : null,
  );
  const faces = [
    winnerFaceLabel,
    ...otherFaceTickets.map((ticketNumber) => formatFaceLabel(ticketNumber)),
  ];

  return (
    <div
      className={cn(
        'jackpot-cylinder',
        `jackpot-cylinder--${phase}`,
        landed && 'jackpot-cylinder--landed',
      )}
    >
      <div className="jackpot-cylinder__scene" aria-hidden="true">
        <div className="jackpot-cylinder__glow" />
        <div className="jackpot-cylinder__grid jackpot-cylinder__grid--ceiling" />
        <div className="jackpot-cylinder__grid jackpot-cylinder__grid--floor" />
        <div className="jackpot-cylinder__viewport">
          <div ref={drumRef} className="jackpot-cylinder__drum">
            {faces.map((label, index) => (
              <div
                key={index}
                className={cn(
                  'jackpot-cylinder__face',
                  index === 0 && 'jackpot-cylinder__face--winner',
                )}
                style={{
                  transform: `rotateX(${index * FACE_ANGLE}deg) translateZ(var(--jackpot-cylinder-radius))`,
                }}
              >
                <img src="/jackpot/jackpot-winning-ticket.webp" alt="" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="jackpot-cylinder__fade jackpot-cylinder__fade--top" />
        <div className="jackpot-cylinder__fade jackpot-cylinder__fade--bottom" />
        <div className="jackpot-cylinder__laser">
          <span />
          <span />
        </div>
      </div>

      {phase === 'revealed' && (
        <div className="jackpot-cylinder__winner">
          <div className="jackpot-stage-reveal__ticket-wrap">
            <img
              className="jackpot-stage-reveal__ticket-art"
              src="/jackpot/jackpot-winning-ticket.webp"
              alt=""
              aria-hidden="true"
            />
            <div className="jackpot-stage-reveal__ticket-copy">
              <span className="jackpot-stage-reveal__label">
                Zwycięski ticket
              </span>
              <strong className="jackpot-stage-reveal__ticket">
                {winnerTicketLabel}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
