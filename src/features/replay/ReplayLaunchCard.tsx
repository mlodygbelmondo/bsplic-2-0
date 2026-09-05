import { ArrowRight, ChartNoAxesCombined } from 'lucide-react';
import { Link } from 'react-router-dom';

/** No history fetch, poster, chart or Replay stylesheet on the profile entry point. */
export function ReplayLaunchCard() {
  return (
    <Link to="/replay" className="app-surface group flex min-h-20 items-center gap-4 rounded-xl p-4 transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <ChartNoAxesCombined size={22} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1"><span className="block font-semibold">Replay</span><span className="mt-0.5 block text-sm text-muted-foreground">Bilans i historia kuponów</span></span>
      <ArrowRight size={18} className="shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
    </Link>
  );
}
