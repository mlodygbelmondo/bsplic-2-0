import { ArrowRight, ChartNoAxesCombined } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Lightweight entry point: no history fetch, chart, canvas or Replay CSS here. */
export function ReplayLaunchCard() {
  return (
    <Link to="/replay" aria-label="BSPLIC Replay" className="app-surface group flex min-h-20 items-center gap-4 rounded-xl p-4 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-5">
      <ChartNoAxesCombined className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1"><span className="block text-lg font-semibold">Replay</span><span className="block text-sm text-muted-foreground">Twoje kupony w liczbach</span></span>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
    </Link>
  );
}
