import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
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
          <span>BSPLIC ORIGINALS · WIRTUALNE MONETY</span>
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
          <p>{config.eyebrow}</p>
          <h1>{config.title}</h1>
          <span>{config.description}</span>
        </header>
        <div className="slots-layout">
          <aside className="slots-sidecard">
            <span className="slots-kicker">JAK GRAMY</span>
            <h2>
              {game === "bandit"
                ? "Mały napad. Wielka noc."
                : "Jeszcze jedna kaskada."}
            </h2>
            <p>{config.rule}.</p>
            <div className="slots-side-detail">
              <strong>{game === "bandit" ? "ZŁOTE POLA" : "MNOŻNIKI"}</strong>
              <span>do 5×</span>
            </div>
            <p>
              {game === "bandit"
                ? "Wygrywaj na tych samych polach i zwiększaj ich mnożniki."
                : "Każda wygrywająca kaskada losuje nowy mnożnik."}
            </p>
            <div className="slots-side-detail">
              <strong>4× BONUS</strong>
              <span>8 obrotów</span>
            </div>
            <p>
              Bezpłatne obroty zostają na Twoim koncie, także po wyjściu z gry.
            </p>
            <Link
              to={`/casino/slots/${game === "bandit" ? "candy" : "bandit"}`}
            >
              Zmień klimat <ArrowRight size={16} />
            </Link>
          </aside>
          <section className="slot-machine" aria-label={config.title}>
            <div className="slot-machine-top">
              <span>
                {freeSpins > 0 ? "DARMOWE OBROTY" : "KASKADY"}
                <strong>{freeSpins > 0 ? freeSpins : "6 × 5"}</strong>
              </span>
              <span className="slot-round-status">
                {busy
                  ? "Losowanie…"
                  : animating
                    ? `Kaskada ${frameIndex + 1}`
                    : "Twój ruch"}
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
                  <span>Potwierdzamy obrót</span>
                  <strong>Powodzenia!</strong>
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
                  <strong>Gotowy na obrót?</strong>
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
              {stopped ? "Sesja zakończona" : "Kończę na dziś"}
            </button>
            {stopped && (
              <div className="slot-session-ended" role="status">
                Zatrzymujesz się z bilansem {money(session.net)}.{" "}
                <Link to="/casino">Wróć do lobby</Link>
              </div>
            )}
            <div className="slots-history">
              <h3>Ostatnie obroty</h3>
              {history.length === 0 ? (
                <p>Twój pierwszy obrót czeka.</p>
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
            Ładowanie konta gry…
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
                Bonus powitalny · pozostało {state.data?.boostRemaining}/10
              </strong>
              <span>
                35% szansy na dodatkową pasującą grupę. Wspólny dla obu gier.
                Szczegóły w zasadach.
              </span>
            </p>
          </div>
        )}
        <p className="slots-footnote">
          Wyłącznie wirtualna waluta. Wypłata to nie zawsze zysk. Bilans
          pokazuje wynik po odjęciu stawki.
        </p>
      </div>
    </div>
  );
}
