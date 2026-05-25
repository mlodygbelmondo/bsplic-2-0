import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Database,
  Grid3X3,
  Loader2,
  Monitor,
  Smartphone,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useRedesignData } from '@/features/redesign/useRedesignData';
import { conceptVariantDefinitions } from './variants';

type FrameMode = 'phone' | 'fill';

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
};

export const ConceptsPlayground = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [pickerOpen, setPickerOpen] = useState(false);
  const { profile } = useAuth();
  const { events, categories, loading, error, hasRealData } = useRedesignData();

  const variantId = Number(searchParams.get('v') ?? '1');
  const variant = useMemo(
    () =>
      conceptVariantDefinitions.find((item) => item.id === variantId) ??
      conceptVariantDefinitions[0],
    [variantId],
  );

  const frameMode: FrameMode =
    (searchParams.get('frame') as FrameMode | null) ??
    (isMobile ? 'fill' : 'phone');

  const setVariant = (id: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('v', String(id));
    setSearchParams(next, { replace: true });
    setPickerOpen(false);
  };

  const setFrameMode = (mode: FrameMode) => {
    const next = new URLSearchParams(searchParams);
    next.set('frame', mode);
    setSearchParams(next, { replace: true });
  };

  const goPrev = () =>
    setVariant(
      variant.id === 1 ? conceptVariantDefinitions.length : variant.id - 1,
    );
  const goNext = () =>
    setVariant(
      variant.id === conceptVariantDefinitions.length ? 1 : variant.id + 1,
    );

  const VariantComponent = variant.component;

  return (
    <div className="min-h-screen w-full bg-[#0a0a12] text-white">
      <div
        className={cn(
          'flex w-full flex-col items-center justify-start',
          frameMode === 'fill'
            ? 'min-h-screen'
            : 'min-h-screen gap-4 px-4 py-6 sm:py-10',
        )}
      >
        {frameMode === 'phone' && (
          <header className="w-full max-w-3xl">
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-violet-400/60">
              Concept lab · prototype {variant.id}/{conceptVariantDefinitions.length}
            </div>
            <h1 className="text-[22px] font-black text-white">{variant.label}</h1>
            <p className="text-[13px] text-white/60">{variant.description}</p>
            <p className="mt-1 text-[11px] text-white/35">
              Osobna trasa od <code className="text-violet-300">/redesign</code> — do
              porównania obok siebie.
            </p>
          </header>
        )}

        <div
          className={cn(
            'relative overflow-hidden bg-black shadow-2xl',
            frameMode === 'phone'
              ? 'h-[820px] w-[390px] rounded-[44px] ring-1 ring-violet-500/20'
              : 'h-screen w-full',
          )}
        >
          <div
            className={cn(
              frameMode === 'phone'
                ? 'pointer-events-none absolute left-1/2 top-2 z-50 h-6 w-32 -translate-x-1/2 rounded-full bg-black'
                : 'hidden',
            )}
          />
          <div className="absolute inset-0">
            <VariantComponent
              key={variant.id}
              events={events}
              categories={categories}
              profile={profile}
              loading={loading}
            />
          </div>
        </div>

        {frameMode === 'phone' && (
          <footer className="w-full max-w-3xl space-y-1 text-center text-[12px] text-white/40">
            <div className="flex items-center justify-center gap-2">
              {loading ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-white/70">
                  <Loader2 className="h-3 w-3 animate-spin" /> Ładowanie z bazy…
                </span>
              ) : error ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-red-200">
                  <AlertTriangle className="h-3 w-3" /> {error}
                </span>
              ) : hasRealData ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-violet-200">
                  <Database className="h-3 w-3" /> {events.length} zakładów z bazy
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-white/70">
                  <Database className="h-3 w-3" /> Brak zakładów – dodaj jakiś w panelu admina
                </span>
              )}
            </div>
            <div>
              Skrót URL · <code>?v={variant.id}</code> · scrolluj w ramce, żeby zobaczyć
              ukrywanie navbara
            </div>
          </footer>
        )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/85 px-2 py-1.5 ring-1 ring-violet-500/25 backdrop-blur">
          <button
            type="button"
            onClick={goPrev}
            className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
            aria-label="Poprzedni prototyp"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-full bg-violet-600 px-4 py-2 text-[12px] font-black text-white hover:brightness-110"
          >
            C{variant.id} · {variant.label}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
            aria-label="Następny prototyp"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="mx-1 h-6 w-px bg-white/15" />
          <button
            type="button"
            onClick={() => setFrameMode(frameMode === 'phone' ? 'fill' : 'phone')}
            className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
            aria-label="Przełącz tryb wyświetlania"
            title={frameMode === 'phone' ? 'Pełny ekran' : 'Tryb telefonu'}
          >
            {frameMode === 'phone' ? (
              <Monitor className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-white/80 hover:bg-white/10"
            aria-label="Lista wariantów"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur sm:items-center"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-t-3xl bg-neutral-950 p-5 ring-1 ring-violet-500/20 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-violet-400/60">
                  Concept lab
                </div>
                <h2 className="text-[18px] font-black text-white">
                  8 nowych kierunków UI
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {conceptVariantDefinitions.map((item) => {
                const isActive = item.id === variant.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVariant(item.id)}
                    className={cn(
                      'rounded-2xl border p-3 text-left transition-colors',
                      isActive
                        ? 'border-violet-500 bg-violet-500/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-white/60">
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-[10px] font-black',
                          isActive
                            ? 'bg-violet-500 text-white'
                            : 'bg-white/10 text-white',
                        )}
                      >
                        C{item.id}
                      </span>
                      {item.slug}
                    </div>
                    <div className="mt-1 text-[14px] font-black text-white">
                      {item.label}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-white/50">
                      {item.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConceptsPlayground;
