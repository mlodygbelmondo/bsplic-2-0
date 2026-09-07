import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AudioLines,
  Gift,
  History,
  Minus,
  Plus,
  RotateCw,
  VolumeX,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";

import { usePageTitle } from "@/hooks/usePageTitle";
import { SlotBoard } from "./SlotBoard";
import { SlotRules } from "./SlotRules";
import {
  INITIAL_FRAME,
  money,
  resultLabel,
  SLOT_GAMES,
  type SlotGame,
  type SlotSpin,
} from "./model";
import { useSlotGame } from "./useSlotGame";
import "./slots.css";

export default function SlotsPage() {
  const { game } = useParams();
  if (game !== "bandit" && game !== "candy")
    return (
      <div className="p-8 text-white">
        Nie ma takiej gry. <Link to="/casino">Wróć do lobby</Link>
      </div>
    );
  return <SlotMachine key={game} game={game} />;
}
function SlotMachine({ game }: { game: SlotGame }) {
  const config = SLOT_GAMES[game];
  usePageTitle(config.title);
  const { state, spin, busy, pending, error, balance } = useSlotGame(game);
  const reduced = useReducedMotion();
  const [stake, setStake] = useState(5);
  const [result, setResult] = useState<SlotSpin | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [sound, setSound] = useState(false);
  const [session, setSession] = useState({ spins: 0, net: 0 });
  const [stopped, setStopped] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const localLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void audio.current?.close();
    };
  }, []);
  const freeSpins = state.data?.freeSpins ?? 0;
  const actualStake =
    pending?.stake ?? (freeSpins > 0 ? state.data!.bonusStake : stake);
  const disabled = busy || animating;
  const frame = result?.frames[frameIndex] ?? INITIAL_FRAME;
  const history = state.data?.history ?? [];
  const tone = (frequency: number) => {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const oscillator = audio.current.createOscillator();
      const gain = audio.current.createGain();
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.055, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        audio.current.currentTime + 0.22,
      );
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.23);
    } catch {
      /* Audio is optional; some browsers suspend it in background tabs. */
    }
  };
  useEffect(() => {
    if (!animating || !result) return;
    const timeout = window.setTimeout(
      () => {
        if (frameIndex + 1 < result.frames.length)
          setFrameIndex((index) => index + 1);
        else {
          setAnimating(false);
          localLock.current = false;
        }
      },
      reduced ? 60 : frame.groups.length > 0 ? 1100 : 450,
    );
    return () => window.clearTimeout(timeout);
  }, [animating, frameIndex, frame.groups.length, reduced, result]);
  async function handleSpin() {
    if (disabled || localLock.current) return;
    localLock.current = true;
    tone(260);
    const next = await spin(actualStake);
    if (!mounted.current) return;
    if (!next) {
      localLock.current = false;
      return;
    }
    setResult(next);
    setFrameIndex(0);
    setAnimating(true);
    setSession((previous) => ({
      spins: previous.spins + 1,
      net: Math.round((previous.net + next.net) * 100) / 100,
    }));
    if (next.net > 0) tone(660);
  }
  return (
    <div
      className={`slots-page slots-${game}`}
      style={{ "--slot-art": `url('${config.image}')` } as React.CSSProperties}
    >
      <div className="slots-atmosphere" />
      <div className="slots-content">
        <div className="slots-topline">
          <Link to="/casino" className="slot-back">
            <ArrowLeft size={17} /> Wszystkie gry
          </Link>
          <div className="flex gap-2">
            <button
              className="slot-icon-button"
              onClick={() => setSound(!sound)}
              aria-label={sound ? "Wyłącz dźwięk" : "Włącz dźwięk"}
              aria-pressed={sound}
            >
              {sound ? <AudioLines size={20} /> : <VolumeX size={20} />}
            </button>
            <SlotRules game={game} />
          </div>
        </div>
        <header className="slots-heading">
          <h1>{config.title}</h1>
        </header>
        <div className="slots-layout">
          <section className="slot-machine" aria-label={config.title}>
            <div className="slot-machine-top">
              <span>
                {freeSpins > 0 ? "DARMOWE OBROTY" : "PLANSZA"}
                <strong>{freeSpins > 0 ? freeSpins : "6 × 5"}</strong>
              </span>
              <span className="slot-round-status">
                {busy
                  ? "Losowanie…"
                  : animating
                    ? `Kaskada ${frameIndex + 1}`
                    : ""}
              </span>
              <span>
                MNOŻNIK<strong>×{frame.multiplier}</strong>
              </span>
            </div>
            <SlotBoard
              game={game}
              frame={frame}
              spinning={busy}
              step={result ? frameIndex + session.spins * 12 : 0}
            />
            <div className="slot-result" role="status" aria-live="polite">
              {busy ? (
                <>
                  <span>Losowanie…</span>
                </>
              ) : animating ? (
                <>
                  <span>Wypłata kaskady</span>
                  <strong>{money(frame.payout)}</strong>
                </>
              ) : result ? (
                <>
                  <span>
                    {resultLabel(result.net)} netto · wypłata{" "}
                    {money(result.payout)}
                  </span>
                  <strong
                    className={
                      result.net > 0
                        ? "slot-positive"
                        : result.net < 0
                          ? "slot-negative"
                          : ""
                    }
                  >
                    {result.net > 0 ? "+" : ""}
                    {money(result.net)}
                  </strong>
                  {result.awardedFreeSpins > 0 && (
                    <small>+8 darmowych obrotów</small>
                  )}
                </>
              ) : (
                <>
                  <span>{config.rule}</span>
                </>
              )}
            </div>
            <div className="slot-controls">
              <div className="slot-stake">
                <label htmlFor="slot-stake">STAWKA</label>
                <div>
                  <button
                    aria-label="Zmniejsz stawkę"
                    disabled={
                      disabled ||
                      freeSpins > 0 ||
                      Boolean(pending) ||
                      stake <= 1
                    }
                    onClick={() => setStake(Math.max(1, stake - 1))}
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    id="slot-stake"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={actualStake}
                    disabled={disabled || freeSpins > 0 || Boolean(pending)}
                    onChange={(event) =>
                      setStake(
                        Math.max(
                          1,
                          Math.min(100, Number(event.target.value) || 1),
                        ),
                      )
                    }
                  />
                  <button
                    aria-label="Zwiększ stawkę"
                    disabled={
                      disabled ||
                      freeSpins > 0 ||
                      Boolean(pending) ||
                      stake >= 100
                    }
                    onClick={() => setStake(Math.min(100, stake + 1))}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <button
                className="slot-spin"
                onClick={() => void handleSpin()}
                disabled={
                  disabled ||
                  stopped ||
                  !state.data ||
                  state.isError ||
                  (!pending && freeSpins === 0 && balance < actualStake)
                }
              >
                <RotateCw className={busy ? "animate-spin" : ""} size={24} />
                <span>
                  {busy
                    ? "LOSOWANIE"
                    : animating
                      ? "KASKADA"
                      : pending
                        ? "SPRAWDŹ OBRÓT"
                        : freeSpins > 0
                          ? "DARMOWY OBRÓT"
                          : "ZAKRĘĆ"}
                </span>
              </button>
            </div>
            <div className="slot-wallet">
              <span>
                Saldo <strong>{money(balance)}</strong>
              </span>
              <span>
                Koszt obrotu{" "}
                <strong>{money(freeSpins > 0 ? 0 : actualStake)}</strong>
              </span>
            </div>
          </section>
          <aside className="slots-session">
            <div className="slots-session-heading">
              <History size={16} />
              <span>TA SESJA</span>
            </div>
            <strong
              className={`slots-session-net ${session.net > 0 ? "slot-positive" : session.net < 0 ? "slot-negative" : ""}`}
            >
              {session.net > 0 ? "+" : ""}
              {money(session.net)}
            </strong>
            <p>Bilans netto · {session.spins} obrotów</p>
            <button
              className="slot-stop"
              disabled={disabled || stopped}
              onClick={() => setStopped(true)}
            >
              {stopped ? "Sesja zakończona" : "Zakończ sesję"}
            </button>
            {stopped && (
              <div className="slot-session-ended" role="status">
                <Link to="/casino">Wróć do lobby</Link>
              </div>
            )}
            <div className="slots-history">
              <h3>Ostatnie obroty</h3>
              {history.length === 0 ? (
                <p>Brak obrotów</p>
              ) : (
                history.slice(0, 5).map((item) => (
                  <div key={item.id}>
                    <span>
                      {item.charged === 0
                        ? "Darmowy"
                        : `Stawka ${money(item.stake)}`}
                    </span>
                    <strong
                      className={
                        item.net > 0
                          ? "slot-positive"
                          : item.net < 0
                            ? "slot-negative"
                            : ""
                      }
                    >
                      {item.net > 0 ? "+" : ""}
                      {money(item.net)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
        {state.isPending && (
          <p className="slots-message" role="status">
            Ładowanie…
          </p>
        )}
        {state.isError && (
          <div className="slots-message" role="alert">
            Nie udało się wczytać gry.{" "}
            <button onClick={() => void state.refetch()}>
              Spróbuj ponownie
            </button>
          </div>
        )}
        {error && (
          <p className="slots-message" role="alert">
            {error}
          </p>
        )}
        {(state.data?.boostRemaining ?? 0) > 0 && (
          <div className="slots-welcome">
            <Gift size={19} />
            <p>
              <strong>
                Bonus startowy · pozostało {state.data?.boostRemaining}/10
              </strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
