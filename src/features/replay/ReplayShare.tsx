import { useEffect, useState } from 'react';
import { Download, RefreshCw, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';

import type { ReplayModel } from './model';

interface PreparedPoster {
  file: File;
  url: string;
  name: string | undefined;
  model: ReplayModel;
  theme: string;
}

export function ReplayShare({ model, username }: { model: ReplayModel; username: string }) {
  const { theme } = useTheme();
  const [includeName, setIncludeName] = useState(false);
  const [prepared, setPrepared] = useState<PreparedPoster | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sharing, setSharing] = useState(false);
  const name = includeName ? username : undefined;
  const poster = prepared && prepared.name === name && prepared.model === model && prepared.theme === theme ? prepared : null;

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
        setPrepared({ url, file: new File([blob], 'bsplic-replay.png', { type: 'image/png' }), name, model, theme });
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [model, name, attempt, theme]);

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
      <div className="replay-poster-preview" aria-busy={!poster && !error}>
        {poster ? <img src={poster.url} alt={`Podgląd Replay${includeName ? ` gracza ${username}` : ' bez nicku'}`} width={1080} height={1920} /> : <p role="status">{error ? 'Podgląd niedostępny' : 'Przygotowywanie…'}</p>}
      </div>
      <div className="replay-share-controls">
        <label className="replay-consent">
          <input type="checkbox" checked={includeName} onChange={(event) => setIncludeName(event.target.checked)} />
          Dodaj mój nick
        </label>
        <div className="replay-actions">
          {poster ? (
            <Button asChild className="h-11"><a href={poster.url} download="bsplic-replay.png"><Download aria-hidden="true" /> Zapisz PNG</a></Button>
          ) : (
            <Button type="button" className="h-11" disabled>{error ? 'Obraz niedostępny' : 'Przygotowywanie…'}</Button>
          )}
          <Button type="button" variant="outline" className="h-11" disabled={!poster || sharing} onClick={() => void handleShare()}><Share2 aria-hidden="true" /> Udostępnij</Button>
        </div>
        <p className="replay-muted">Udostępnisz tylko ten obraz.</p>
        {error && <div role="alert" className="replay-notice">Nie udało się utworzyć plakatu. <Button type="button" variant="outline" className="h-11" onClick={() => setAttempt((value) => value + 1)}><RefreshCw aria-hidden="true" /> Spróbuj ponownie</Button></div>}
      </div>
    </div>
  );
}
