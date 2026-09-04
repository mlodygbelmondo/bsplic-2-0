import { useEffect, useState } from 'react';
import { Download, RefreshCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import type { ReplayModel } from './model';

interface PreparedPoster {
  file: File;
  url: string;
  name: string | undefined;
  model: ReplayModel;
}

export function ReplayShare({ model, username }: { model: ReplayModel; username: string }) {
  const [includeName, setIncludeName] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPoster | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const name = includeName ? username : undefined;
  const poster = prepared && prepared.name === name && prepared.model === model ? prepared : null;

  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setError(false);
    setPrepared(null);
    void import('./poster')
      .then(({ createReplayPoster }) => createReplayPoster(model, name))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPrepared({ url, file: new File([blob], 'bsplic-replay.png', { type: 'image/png' }), name, model });
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [model, name, attempt]);

  const handleShare = async () => {
    if (!poster || sharing) return;
    setSharing(true);
    try {
      // Prepare before the click so iOS still sees this as a user gesture.
      if (!navigator.canShare?.({ files: [poster.file] }) || !navigator.share) {
        toast.info('Zapisz PNG i udostępnij go w wybranej aplikacji.');
        return;
      }
      await navigator.share({ files: [poster.file], title: 'Mój BSPLIC Replay' });
    } catch (cause) {
      if (!(typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError')) {
        toast.error('Udostępnianie nie powiodło się. Możesz zapisać PNG.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="replay-share-layout">
      <div>
        <p className="replay-eyebrow">05 / KADR NA KONIEC</p>
        <h2>Twoja historia.<br /><em>Twój plakat.</em></h2>
        <p className="replay-copy">Niech liczby zostaną z Tobą. Pionowy plakat 1080 × 1920, gotowy do zapisania lub wysłania ekipie.</p>
        <label className="replay-consent">
          <input type="checkbox" checked={includeName} onChange={(event) => setIncludeName(event.target.checked)} />
          Dodaj mój nick do plakatu
        </label>
        <div className="replay-actions">
          {poster ? (
            <a className="replay-button replay-button-primary" href={poster.url} download="bsplic-replay.png"><Download aria-hidden="true" size={18} /> Zapisz PNG</a>
          ) : (
            <button type="button" className="replay-button replay-button-primary" disabled>Przygotowywanie…</button>
          )}
          <button type="button" className="replay-button" disabled={!poster || sharing} onClick={() => void handleShare()}><Share2 aria-hidden="true" size={18} /> Udostępnij</button>
        </div>
        <p className="replay-note">Plakat zawiera pokazane statystyki. Powstaje tylko na Twoim urządzeniu. Nic nie publikujemy automatycznie.</p>
        {error && <div role="alert" className="replay-notice">Nie udało się utworzyć plakatu. <button type="button" className="replay-button" onClick={() => setAttempt((value) => value + 1)}><RefreshCw aria-hidden="true" size={16} /> Spróbuj ponownie</button></div>}
      </div>
      <div className="replay-poster-preview" aria-busy={!poster && !error}>
        {poster ? <img src={poster.url} alt={`Podgląd plakatu BSPLIC Replay${includeName ? ` gracza ${username}` : ' bez nicku'}`} width={1080} height={1920} /> : <p role="status">{error ? 'Podgląd niedostępny' : 'Wywołujemy Twój kadr…'}</p>}
      </div>
    </div>
  );
}
