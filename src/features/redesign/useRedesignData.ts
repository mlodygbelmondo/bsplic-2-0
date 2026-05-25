import { useEffect, useMemo, useState } from 'react';
import { fetchActiveBets } from '@/features/home/api/bets';
import { fetchCategories } from '@/features/home/api/categories';
import type { Bet, BetOption, Category } from '@/types/database';

export type DisplayOption = {
  label: string;
  short: string;
  odds: number;
  isHighest?: boolean;
};

export type DisplayEvent = {
  id: string;
  title: string;
  league: string;
  leagueEmoji: string;
  leagueColor: string;
  startsAt: string;
  endsAtTimestamp: number;
  isLive: boolean;
  isBoosted: boolean;
  options: DisplayOption[];
  popularity: number;
};

export type DisplayCategory = {
  id: string;
  label: string;
  emoji: string;
};

const formatStartLabel = (endsAt: string) => {
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  if (sameDay) {
    return time;
  }

  const day = new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);

  return `${day} · ${time}`;
};

const buildShortLabel = (label: string) => {
  const trimmed = label.trim();
  if (!trimmed) {
    return '—';
  }

  if (trimmed.length <= 4) {
    return trimmed.toUpperCase();
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return trimmed.slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
};

const toDisplayOptions = (options: BetOption[]): DisplayOption[] => {
  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }

  let highestOdds = -Infinity;
  options.forEach((option) => {
    const value = Number(option.odds);
    if (Number.isFinite(value) && value > highestOdds) {
      highestOdds = value;
    }
  });

  return options.map((option) => {
    const value = Number(option.odds);
    return {
      label: option.name,
      short: buildShortLabel(option.name),
      odds: Number.isFinite(value) ? value : 0,
      isHighest: Number.isFinite(value) && value === highestOdds,
    };
  });
};

const toDisplayEvent = (bet: Bet, categoryMap: Record<string, Category>): DisplayEvent => {
  const category = bet.category_id ? categoryMap[bet.category_id] : undefined;

  return {
    id: bet.id,
    title: bet.title,
    league: category?.name ?? 'Inne',
    leagueEmoji: category?.emoji ?? '✦',
    leagueColor: category?.color ?? '#ef4444',
    startsAt: formatStartLabel(bet.ends_at),
    endsAtTimestamp: new Date(bet.ends_at).getTime(),
    isLive: Boolean(bet.is_live),
    isBoosted: Boolean(bet.is_bsplicboost),
    options: toDisplayOptions(bet.options),
    popularity: Math.min(100, Math.round(Math.log2(bet.bet_count + 2) * 18)),
  };
};

const sortEvents = (events: DisplayEvent[]) =>
  [...events].sort((a, b) => {
    if (a.isLive !== b.isLive) {
      return a.isLive ? -1 : 1;
    }

    if (a.isBoosted !== b.isBoosted) {
      return a.isBoosted ? -1 : 1;
    }

    return a.endsAtTimestamp - b.endsAtTimestamp;
  });

export const useRedesignData = () => {
  const [bets, setBets] = useState<Bet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [categoryRows, betRows] = await Promise.all([
          fetchCategories(),
          fetchActiveBets(null),
        ]);

        if (!mounted) {
          return;
        }

        setCategories(categoryRows);
        setBets(betRows);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'unknown error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const categoryMap = useMemo(() => {
    return categories.reduce<Record<string, Category>>((map, category) => {
      map[category.id] = category;
      return map;
    }, {});
  }, [categories]);

  const events = useMemo(
    () => sortEvents(bets.map((bet) => toDisplayEvent(bet, categoryMap))),
    [bets, categoryMap],
  );

  const displayCategories = useMemo<DisplayCategory[]>(
    () =>
      categories.map((category) => ({
        id: category.id,
        label: category.name,
        emoji: category.emoji,
      })),
    [categories],
  );

  return {
    events,
    categories: displayCategories,
    loading,
    error,
    hasRealData: events.length > 0,
  };
};
