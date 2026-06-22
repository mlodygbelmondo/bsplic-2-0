import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Gift,
  Loader2,
  Play,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

import {
  claimDailyJackpotReward,
  getDailyJackpotDraw,
  revealDailyJackpotDraw,
} from '../api/jackpot';
import { formatJackpotAmount } from '../lib/jackpotFormat';
import type { DailyJackpotClaimResult, DailyJackpotDraw } from '../types';
import '../styles/jackpotDrawPage.css';

type ReplayPhase = 'intro' | 'drawing' | 'revealed';

const DRAWING_FLIGHT_MS = 3300;
const REDUCED_MOTION_FLIGHT_MS = 160;
const WINNING_TICKET_CENTER_PROGRESS = 0.51;
const WINNING_TICKET_ANIMATION_DELAY_SECONDS = -(
  (DRAWING_FLIGHT_MS / 1000) *
  WINNING_TICKET_CENTER_PROGRESS
);

interface DrawTicketVisual {
  key: string;
  ticketNumber: number;
  ticketLabel: string;
}

type TicketFlightStyle = CSSProperties & {
  '--ticket-index': number;
  '--ticket-count': number;
  '--ticket-lane-offset': string;
  '--ticket-lane-tight': string;
  '--ticket-lane-invert': string;
  '--ticket-delay': string;
};

function getVisibleDrawTickets(
  drawTickets: DrawTicketVisual[],
  winningTicketNumber: number | null,
) {
  const winningTicket =
    winningTicketNumber === null
      ? null
      : drawTickets.find((ticket) => ticket.ticketNumber === winningTicketNumber);

  if (drawTickets.length <= 18) {
    if (!winningTicket) {
      return drawTickets;
    }

    return [
      ...drawTickets.filter(
        (ticket) => ticket.ticketNumber !== winningTicket.ticketNumber,
      ),
      winningTicket,
    ];
  }

  const visibleTickets = drawTickets
    .filter(
      (_, index) =>
        index % Math.max(1, Math.ceil(drawTickets.length / 18)) === 0,
    )
    .slice(0, 18);

  if (!winningTicket) {
    return visibleTickets;
  }

  const visibleTicketsWithoutWinner = visibleTickets.filter(
    (ticket) => ticket.ticketNumber !== winningTicket.ticketNumber,
  );

  return [...visibleTicketsWithoutWinner.slice(0, 17), winningTicket];
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

function getInitials(username: string) {
  return username.trim().slice(0, 2).toUpperCase() || '??';
}

function formatDrawDate(poolDate: string) {
  const date = new Date(`${poolDate}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: 'long',
    timeZone: 'Europe/Warsaw',
  }).format(date);
}

function formatDrawDateNumeric(poolDate: string) {
  const date = new Date(`${poolDate}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Warsaw',
  }).format(date);
}

function formatJackpotHeroAmount(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const hasCents = Math.round(safeAmount) !== safeAmount;

  return `${safeAmount.toLocaleString('pl-PL', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  })} zł`;
}

function formatTicketNumber(ticket: number) {
  return String(ticket).padStart(2, '0');
}

function hasVisibleWinnerDetails(draw: DailyJackpotDraw) {
  return Boolean(
    draw.winnerUserId &&
      draw.winnerUsername &&
      draw.winningTicketNumber !== null,
  );
}

function JackpotDrawBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      className="jackpot-draw-icon-back"
      aria-label="Wróć do poprzedniego widoku"
      onClick={onBack}
    >
      <ArrowLeft className="h-4 w-4" />
    </button>
  );
}

function formatPolishCount(
  count: number,
  singular: string,
  few: string,
  many: string,
) {
  const absoluteCount = Math.abs(count);
  const lastDigit = absoluteCount % 10;
  const lastTwoDigits = absoluteCount % 100;

  if (absoluteCount === 1) {
    return `${count} ${singular}`;
  }

  if (
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    !(lastTwoDigits >= 12 && lastTwoDigits <= 14)
  ) {
    return `${count} ${few}`;
  }

  return `${count} ${many}`;
}

interface JackpotDrawExperienceProps {
  roundId?: string;
  currentUserId?: string | null;
  initialDraw?: DailyJackpotDraw | null;
  loadDraw: (roundId: string) => Promise<DailyJackpotDraw>;
  revealDraw: (poolId: string) => Promise<DailyJackpotDraw>;
  claimDrawReward: (poolId: string) => Promise<DailyJackpotClaimResult>;
  refreshAfterClaim?: () => Promise<void> | void;
  onBack: () => void;
}

export function JackpotDrawExperience({
  roundId,
  currentUserId,
  initialDraw = null,
  loadDraw,
  revealDraw,
  claimDrawReward,
  refreshAfterClaim,
  onBack,
}: JackpotDrawExperienceProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [draw, setDraw] = useState<DailyJackpotDraw | null>(initialDraw);
  const [phase, setPhase] = useState<ReplayPhase>('intro');
  const [loading, setLoading] = useState(!initialDraw);
  const [claiming, setClaiming] = useState(false);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const replayTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (initialDraw) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadDrawData() {
      if (!roundId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextDraw = await loadDraw(roundId);
        if (!cancelled) {
          setDraw(nextDraw);
          setPhase('intro');
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : 'Nie udało się wczytać losowania';
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDrawData();

    return () => {
      cancelled = true;
    };
  }, [initialDraw, loadDraw, roundId]);

  useEffect(() => {
    return () => {
      if (replayTimeoutRef.current !== null) {
        window.clearTimeout(replayTimeoutRef.current);
      }
    };
  }, []);

  const winnerTicketLabel = useMemo(() => {
    if (!draw?.winningTicketNumber) {
      return 'Ticket zwycięzcy';
    }

    return `Ticket #${draw.winningTicketNumber}`;
  }, [draw?.winningTicketNumber]);

  const rewardStateLabel = useMemo(() => {
    if (!draw) {
      return null;
    }

    if (draw.rewardCreditStatus === 'claimed') {
      return 'Nagroda odebrana';
    }

    if (draw.rewardCreditStatus === 'auto_credited') {
      return 'Nagroda została dodana automatycznie';
    }

    return null;
  }, [draw]);

  const startReplay = () => {
    if (!draw || phase !== 'intro') {
      return;
    }

    setPhase('drawing');
    const flightDelay = reducedMotion
      ? REDUCED_MOTION_FLIGHT_MS
      : DRAWING_FLIGHT_MS;

    if (replayTimeoutRef.current !== null) {
      window.clearTimeout(replayTimeoutRef.current);
    }

    const finishReplay = (nextDraw: DailyJackpotDraw) => {
      setDraw(nextDraw);
      setPhase('revealed');
    };

    const revealPromise =
      draw.resultViewedAt && hasVisibleWinnerDetails(draw)
        ? Promise.resolve(draw)
        : revealDraw(draw.poolId).then((revealedDraw) => {
            if (!hasVisibleWinnerDetails(revealedDraw)) {
              throw new Error('Nie udało się odsłonić pełnego wyniku');
            }

            setDraw(revealedDraw);

            return revealedDraw;
          });

    void revealPromise.catch(() => undefined);

    replayTimeoutRef.current = window.setTimeout(() => {
      replayTimeoutRef.current = null;

      void revealPromise
        .then(finishReplay)
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : 'Nie udało się odsłonić wyniku';
          toast.error(message);
          setPhase('intro');
        });
    }, flightDelay);
  };

  const claimReward = async () => {
    if (!draw || claiming) {
      return;
    }

    setClaiming(true);
    try {
      const result = await claimDrawReward(draw.poolId);
      setDraw((current) =>
        current
          ? {
              ...current,
              rewardClaimedAt: result.rewardClaimedAt,
              rewardAutoCreditedAt: result.rewardAutoCreditedAt,
              rewardCreditStatus: result.rewardCreditStatus,
            }
          : current,
      );
      await refreshAfterClaim?.();
      toast.success(
        result.alreadyCredited
          ? 'Nagroda była już dodana'
          : `Odebrano ${formatJackpotAmount(result.amount)}`,
        { position: 'bottom-center' },
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nie udało się odebrać nagrody';
      toast.error(message);
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <main className="jackpot-draw-page">
        <div className="jackpot-draw-shell">
          <div className="jackpot-draw-loading">
            <Loader2 className="h-5 w-5 animate-spin" />
            Ładowanie losowania
          </div>
        </div>
      </main>
    );
  }

  if (!draw) {
    return (
      <main className="jackpot-draw-page">
        <div className="jackpot-draw-shell">
          <div className="jackpot-draw-topbar">
            <JackpotDrawBackButton onBack={onBack} />
          </div>
          <section className="jackpot-draw-empty">
            Nie znaleziono tego losowania.
          </section>
        </div>
      </main>
    );
  }

  const revealed = phase === 'revealed';
  const drawingActive = phase === 'drawing';
  const canClaim =
    revealed &&
    draw.currentUserIsWinner &&
    draw.rewardCreditStatus === 'pending';
  const rolledOver = draw.status === 'rolled_over';
  const numericDrawDate = formatDrawDateNumeric(draw.poolDate);
  const participantCountLabel = formatPolishCount(
    draw.participantCount,
    'gracz',
    'gracze',
    'graczy',
  );
  const ticketCountLabel = formatPolishCount(
    draw.ticketCount,
    'los',
    'losy',
    'losów',
  );
  const prizeAmountLabel = formatJackpotHeroAmount(draw.prizeAmount);
  const currentUserTicketLabels = currentUserId
    ? (draw.participants.find((participant) => participant.userId === currentUserId)
        ?.ticketNumbers ?? [])
        .slice()
        .sort((left, right) => left - right)
        .map((ticketNumber) => `#${formatTicketNumber(ticketNumber)}`)
    : [];
  const drawTickets: DrawTicketVisual[] = draw.participants
    .flatMap((participant) =>
      participant.ticketNumbers.map((ticketNumber) => ({
        key: `${participant.userId}-${ticketNumber}`,
        ticketNumber,
        ticketLabel: formatTicketNumber(ticketNumber),
      })),
    )
    .sort((left, right) => left.ticketNumber - right.ticketNumber);
  const visibleDrawTickets = getVisibleDrawTickets(
    drawTickets,
    draw.winningTicketNumber,
  );
  const hasHiddenRosterParticipants = draw.participants.length > 10;
  const rosterParticipants = rosterExpanded
    ? draw.participants
    : draw.participants.slice(0, 10);

  if (rolledOver) {
    return (
      <main className="jackpot-draw-page jackpot-draw-page--replay">
        <div className="jackpot-replay-shell">
          <div className="jackpot-draw-topbar">
            <JackpotDrawBackButton onBack={onBack} />
            <span>Losowanie z {numericDrawDate}</span>
          </div>

          <section className="jackpot-draw-hero" aria-labelledby="jackpot-draw-title">
            <div className="jackpot-draw-hero__copy">
              <h1 id="jackpot-draw-title">Pula przeszła na kolejny dzień</h1>
              <p>
                {formatDrawDate(draw.poolDate)}, pula{' '}
                <strong>{prizeAmountLabel}</strong>
              </p>
            </div>

            <div className="jackpot-draw-hero__meta" aria-label="Dane rundy">
              <div>
                <span>Graczy</span>
                <strong>{draw.participantCount}</strong>
                <span className="sr-only">{participantCountLabel}</span>
              </div>
              <div>
                <span>Ticketów</span>
                <strong>{draw.ticketCount}</strong>
                <span className="sr-only">{ticketCountLabel}</span>
              </div>
              <div>
                <span>Finał</span>
                <strong>20:00</strong>
              </div>
            </div>
          </section>

          <section className="jackpot-draw-stage" aria-live="polite">
            <div className="jackpot-draw-result">
              <div className="jackpot-draw-result__icon">
                <Ticket className="h-7 w-7" />
              </div>
              <p className="jackpot-draw-result__label">Brak losowania</p>
              <h2>Pula została przeniesiona</h2>
              <p className="jackpot-draw-result__ticket">
                Tickety z tej rundy zostały rozliczone bez reveal i claim.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="jackpot-draw-page jackpot-draw-page--replay">
      <div className="jackpot-replay-shell">
        <div className="jackpot-draw-topbar">
          <JackpotDrawBackButton onBack={onBack} />
          <span>Losowanie z {numericDrawDate}</span>
        </div>

        <section className="jackpot-draw-hero jackpot-draw-hero--summary" aria-label="Dane losowania">
          <div className="jackpot-draw-hero__meta" aria-label="Dane rundy">
            <div>
              <span>Pula</span>
              <strong>{prizeAmountLabel}</strong>
            </div>
            <div>
              <span>Data losowania</span>
              <strong>{formatDrawDate(draw.poolDate)}</strong>
              <small>20:00</small>
            </div>
            <div>
              <span>Graczy</span>
              <strong>{draw.participantCount}</strong>
              <span className="sr-only">{participantCountLabel}</span>
            </div>
            <div>
              <span>Ticketów</span>
              <strong>{draw.ticketCount}</strong>
              <span className="sr-only">{ticketCountLabel}</span>
            </div>
          </div>
        </section>

        {currentUserTicketLabels.length > 0 && (
          <div
            className="jackpot-draw-user-tickets"
            aria-label="Twoje numery ticketów"
          >
            <span>Twoje tickety</span>
            <strong>{currentUserTicketLabels.join(' ')}</strong>
          </div>
        )}

        <div className="jackpot-replay-layout">
          <section
            className={cn('jackpot-draw-stage', `jackpot-draw-stage--${phase}`)}
            aria-live="polite"
          >
            <div className="jackpot-stage-title" aria-hidden="true">
              <span>◆</span>
              Tickety w puli
              <span>◆</span>
            </div>
            <img
              className="jackpot-stage-asset"
              src="/jackpot/jackpot-draw-stage.png"
              alt=""
              aria-hidden="true"
            />

            {drawingActive && (
              <motion.div className="jackpot-ticket-flight">
                <div className="jackpot-ticket-flight__header">
                  <span>Losowanie ticketów</span>
                  <strong>{formatPolishCount(drawTickets.length, 'ticket', 'tickety', 'ticketów')}</strong>
                </div>

                <ul
                  className="jackpot-ticket-flight__track"
                  aria-label="Animowane tickety w puli"
                >
                  {visibleDrawTickets.map((ticket, index) => {
                    const lane = (index % 5) - 2;
                    const isWinningTicket =
                      draw.winningTicketNumber === ticket.ticketNumber;

                    return (
                      <li
                        key={ticket.key}
                        className="jackpot-flight-ticket"
                        style={
                          {
                            '--ticket-index': index,
                            '--ticket-count': visibleDrawTickets.length,
                            '--ticket-lane-offset': `${lane}rem`,
                            '--ticket-lane-tight': `${lane * 0.45}rem`,
                            '--ticket-lane-invert': `${lane * -0.35}rem`,
                            '--ticket-delay': isWinningTicket
                              ? `${WINNING_TICKET_ANIMATION_DELAY_SECONDS}s`
                              : `calc(${index} * -0.22s)`,
                          } satisfies TicketFlightStyle
                        }
                      >
                        <img
                          className="jackpot-flight-ticket__asset"
                          src="/jackpot/jackpot-ticket.png"
                          alt=""
                          aria-hidden="true"
                        />
                        <span className="jackpot-flight-ticket__number">
                          #{ticket.ticketLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}

            {phase === 'revealed' && (
              <motion.div
                className="jackpot-stage-reveal"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={reducedMotion ? undefined : { opacity: 1 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
              >
                <div className="jackpot-stage-reveal__status">
                  <Trophy className="h-4 w-4" />
                  Wynik losowania
                </div>
                <h2>Wygrywa {draw.winnerUsername ?? 'zwycięzca'}</h2>
                <div className="jackpot-stage-reveal__ticket-wrap">
                  <img
                    className="jackpot-stage-reveal__ticket-art"
                    src="/jackpot/jackpot-winning-ticket.png"
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
                <p>
                  Wygrana <strong>{prizeAmountLabel}</strong>
                </p>

                {canClaim && (
                  <Button
                    type="button"
                    variant={null}
                    size={null}
                    className="jackpot-stage-claim"
                    disabled={claiming}
                    onClick={() => void claimReward()}
                  >
                    {claiming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Gift className="h-4 w-4" />
                    )}
                    Odbierz nagrodę
                  </Button>
                )}

                {rewardStateLabel && (
                  <div className="jackpot-draw-claimed">
                    <CheckCircle2 className="h-4 w-4" />
                    {rewardStateLabel}
                  </div>
                )}
              </motion.div>
            )}

            <div className="jackpot-draw-actions">
              {phase === 'intro' && (
                <Button
                  type="button"
                  variant={null}
                  size={null}
                  className="jackpot-draw-primary"
                  onClick={startReplay}
                >
                  <Play className="h-5 w-5" />
                  {draw.resultViewedAt
                    ? 'Obejrzyj losowanie'
                    : 'Rozpocznij losowanie'}
                </Button>
              )}

              {drawingActive && (
                <div className="jackpot-draw-progress">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Losowanie trwa
                </div>
              )}
            </div>
          </section>

          <aside
            className={cn(
              'jackpot-draw-roster',
              rosterExpanded && 'jackpot-draw-roster--expanded',
            )}
            aria-label="Uczestnicy i ich tickety"
          >
            <header>
              <Users className="h-5 w-5" />
              <h2>Uczestnicy i ich tickety</h2>
            </header>
            <div className="jackpot-draw-roster__columns">
              <span>Uczestnik</span>
              <span>Tickety</span>
            </div>
            <div className="jackpot-draw-roster__list">
              {rosterParticipants.map((participant, index) => (
                <article key={participant.userId} className="jackpot-roster-row">
                  <span>{index + 1}</span>
                  <div className="jackpot-result-avatar">
                    {participant.avatarUrl ? (
                      <img src={participant.avatarUrl} alt="" />
                    ) : (
                      getInitials(participant.username)
                    )}
                  </div>
                  <strong>{participant.username}</strong>
                  <div className="jackpot-ticket-list">
                    {participant.ticketNumbers.slice(0, 3).map((ticket) => (
                      <span key={ticket}>{formatTicketNumber(ticket)}</span>
                    ))}
                  </div>
                  <span className="sr-only">
                    {formatPolishCount(
                      participant.ticketCount,
                      'ticket',
                      'tickety',
                      'ticketów',
                    )}
                  </span>
                </article>
              ))}
            </div>
            {hasHiddenRosterParticipants && (
              <button
                type="button"
                className="jackpot-roster-more"
                aria-expanded={rosterExpanded}
                onClick={() => setRosterExpanded((expanded) => !expanded)}
              >
                {rosterExpanded
                  ? 'Pokaż mniej'
                  : `Pokaż wszystkich (${draw.participantCount})`}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 transition-transform',
                    rosterExpanded && 'rotate-180',
                  )}
                />
              </button>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function JackpotDrawPage() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { refreshProfile, user } = useAuth();

  return (
    <JackpotDrawExperience
      roundId={roundId}
      currentUserId={user?.id}
      loadDraw={getDailyJackpotDraw}
      revealDraw={revealDailyJackpotDraw}
      claimDrawReward={claimDailyJackpotReward}
      refreshAfterClaim={refreshProfile}
      onBack={() => navigate('/')}
    />
  );
}
