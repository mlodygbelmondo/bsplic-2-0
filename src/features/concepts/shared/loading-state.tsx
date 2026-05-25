import { Loader2 } from 'lucide-react';

type Props = {
  label?: string;
};

export const ConceptLoadingState = ({ label = 'Ładowanie…' }: Props) => (
  <div className="flex h-40 items-center justify-center gap-2 text-sm text-white/50">
    <Loader2 className="h-4 w-4 animate-spin" />
    {label}
  </div>
);
