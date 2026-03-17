import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetchReactors, type ReactorUser } from '@/features/social/api/reactions';
import { REACTION_EMOJIS, REACTION_TYPES, type ReactionType } from '@/features/social/reactions';

interface ReactorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { postId?: string; couponId?: string; commentId?: string } | null;
  initialEmoji: ReactionType | null;
}

export function ReactorsDialog({ open, onOpenChange, target, initialEmoji }: ReactorsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [reactors, setReactors] = useState<ReactorUser[]>([]);
  const [activeTab, setActiveTab] = useState<ReactionType | null>(null);

  const reactorsByType = useMemo(() => {
    return REACTION_TYPES.reduce<Record<ReactionType, ReactorUser[]>>((acc, type) => {
      acc[type] = reactors.filter((reactor) => reactor.emoji === type);
      return acc;
    }, {
      like: [],
      heart: [],
      laugh: [],
      wow: [],
      sad: [],
      angry: [],
      fire: [],
    });
  }, [reactors]);

  const availableTabs = useMemo(
    () => REACTION_TYPES.filter((type) => reactorsByType[type].length > 0),
    [reactorsByType],
  );

  useEffect(() => {
    if (!open || !target) {
      setReactors([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchReactors({ ...target });
        if (!cancelled) {
          setReactors(data);
        }
      } catch {
        if (!cancelled) {
          setReactors([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, target]);

  useEffect(() => {
    if (!open || availableTabs.length === 0) {
      setActiveTab(null);
      return;
    }

    const nextTab = initialEmoji && availableTabs.includes(initialEmoji)
      ? initialEmoji
      : availableTabs[0];
    setActiveTab(nextTab);
  }, [availableTabs, initialEmoji, open, target]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-md max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Reakcje</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie...</p>
        ) : reactors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak reakcji</p>
        ) : (
          <Tabs
            value={activeTab ?? undefined}
            onValueChange={(value) => setActiveTab(value as ReactionType)}
            className="space-y-2"
          >
            <TabsList className="w-full justify-start overflow-x-auto gap-1 h-auto whitespace-nowrap p-1">
              {availableTabs.map((type) => (
                <TabsTrigger key={type} value={type} className="text-xs px-2.5 py-1.5">
                  {REACTION_EMOJIS[type]} {reactorsByType[type].length}
                </TabsTrigger>
              ))}
            </TabsList>

            {availableTabs.map((type) => (
              <TabsContent key={type} value={type} className="mt-0">
                <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
                  {reactorsByType[type].map((reactor) => (
                    <Link
                      key={`${reactor.user_id}-${reactor.created_at}`}
                      to={`/profile/${encodeURIComponent(reactor.username)}`}
                      onClick={() => onOpenChange(false)}
                      className="block rounded-md px-2 py-1.5 text-sm font-medium text-foreground hover:bg-muted hover:text-primary transition-colors"
                    >
                      @{reactor.username}
                    </Link>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
