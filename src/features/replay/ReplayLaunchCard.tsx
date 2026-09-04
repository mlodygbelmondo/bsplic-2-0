import { ArrowUpRight, Clapperboard } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Lightweight entry point: no history fetch, chart, canvas or Replay CSS here. */
export function ReplayLaunchCard() {
  return (
    <Link to="/replay" className="group relative flex min-h-[112px] items-center gap-4 overflow-hidden rounded-2xl border border-rose-300/25 bg-gradient-to-br from-[#51132e] via-[#290d20] to-[#170c15] p-5 text-[#fff5e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 sm:p-6">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200/30 bg-amber-200/10 text-amber-200"><Clapperboard size={24} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-200">Nowe · BSPLIC Replay</span><span className="block text-xl font-black tracking-tight sm:text-2xl">Twoja gra. Bez filtra.</span><span className="mt-1 block text-xs leading-relaxed text-rose-100/90">Odtwórz historię kuponów i stwórz swój plakat.</span></span>
      <ArrowUpRight size={24} className="shrink-0 text-amber-200" aria-hidden="true" />
    </Link>
  );
}
