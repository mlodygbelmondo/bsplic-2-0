import { useEffect, useState } from 'react';
import { Download, RefreshCw, Share2, X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTheme, type Theme } from '@/contexts/ThemeContext';

import type { ReplayModel } from './model';

interface PreparedPoster {
  file: File;
  url: string;
  name: string | undefined;
  model: ReplayModel;
  theme: Theme;
}

export function ReplayShare({ model, username }: { model: ReplayModel; username: string }) {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button type="button" variant="outline" className="h-11 w-11 p-0 sm:w-auto sm:px-4" aria-label="Udostępnij" title="Udostępnij"><Share2 aria-hidden="true" /><span className="hidden sm:inline">Udostępnij</span></Button></DialogTrigger>
      <DialogContent hideCloseButton className="replay-share-dialog p-5 sm:p-6">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle>Udostępnij podsumowanie</DialogTitle>
          <DialogDescription>PNG powstaje na tym urządzeniu. Nick jest opcjonalny.</DialogDescription>
        </DialogHeader>
        <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-11 w-11" aria-label="Zamknij"><X aria-hidden="true" /></Button></DialogClose>
        {open && <PosterPreview model={model} username={username} theme={theme} />}
      </DialogContent>
    </Dialog>
  );
}

function PosterPreview({ model, username, theme }: { model: ReplayModel; username: string; theme: Theme }) {
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
  }, [model, name, theme, attempt]);

  const handleShare = async () => {
    if (!poster || sharing) return;
    setSharing(true);
    try {
      // The file exists before the click: keep iOS's transient user activation.
      if (!navigator.canShare?.({ files: [poster.file] }) || !navigator.share) {
        toast.info('Zapisz PNG i udostępnij go w wybranej aplikacji.');
        return;
      }
      await navigator.share({ files: [poster.file], title: 'BSPLIC Replay' });
    } catch (cause) {
      if (!(typeof cause === 'object' && cause !== null && 'name' in cause && cause.name === 'AbortError')) {
        toast.error('Udostępnianie nie powiodło się. Możesz zapisać PNG.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div className="replay-poster-preview min-h-24" aria-busy={!poster && !error}>
        {poster ? <img key={poster.url} src={poster.url} alt={`Podgląd podsumowania${includeName ? ` gracza ${username}` : ' bez nicku'}`} width={1080} height={1920} /> : <p role="status" className="py-8 text-center text-sm text-muted-foreground">{error ? 'Podgląd niedostępny' : 'Przygotowywanie…'}</p>}
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-foreground" checked={includeName} onChange={(event) => setIncludeName(event.target.checked)} /> Dodaj mój nick
      </label>
      {error && <div role="alert" className="space-y-3 text-sm">
        <p>Nie udało się utworzyć podsumowania.</p>
        <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}><RefreshCw aria-hidden="true" /> Spróbuj ponownie</Button>
      </div>}
      <div className="flex flex-wrap gap-2">
        {poster ? <Button asChild variant="secondary" className="h-11"><a href={poster.url} download="bsplic-replay.png"><Download aria-hidden="true" /> Zapisz PNG</a></Button> : <Button type="button" variant="secondary" className="h-11" disabled>Zapisz PNG</Button>}
        <Button type="button" variant="outline" className="h-11" disabled={!poster || sharing} onClick={() => void handleShare()}><Share2 aria-hidden="true" /> Wyślij</Button>
      </div>
    </>
  );
}
