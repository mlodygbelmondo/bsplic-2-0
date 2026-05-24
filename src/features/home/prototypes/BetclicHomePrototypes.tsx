import {
  type CSSProperties,
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgePlus,
  BarChart3,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Coins,
  Crown,
  Flame,
  Gamepad2,
  Gauge,
  Home,
  Layers3,
  Lightbulb,
  ListChecks,
  Menu,
  Plus,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Ticket,
  Timer,
  Trophy,
  UserRound,
  Wallet,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useCoupon } from '@/contexts/CouponContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Bet, BetOption, Category, Profile } from '@/types/database';
import './betclic-home-prototypes.css';

type PrototypeRole = 'user' | 'admin';
type SortMode = 'newest' | 'popular' | 'ending_soon';
type SplashVariant = 1 | 2 | 3 | 4 | 5;

interface PrototypeVariant {
  id: number;
  label: string;
  title: string;
  accent: string;
  accent2: string;
  glow: string;
  layout:
    | 'reference'
    | 'live'
    | 'boost'
    | 'compact'
    | 'missions'
    | 'casino'
    | 'admin'
    | 'minimal';
}

interface PrototypeStats {
  activeBets: number;
  liveBets: number;
  boostBets: number;
  categoryCount: number;
  couponItems: number;
  couponOdds: number;
  pendingProposals: number;
  placedBets: number;
  totalPool: number;
}

interface AdminMetrics {
  pendingProposals: number;
  placedBets: number;
  totalPool: number;
  recentResolved: Pick<Bet, 'id' | 'title' | 'winning_option' | 'created_at'>[];
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  badge?: string;
  active?: boolean;
  emphasis?: boolean;
}

const variants: PrototypeVariant[] = [
  {
    id: 1,
    label: 'Reference',
    title: 'Feed z kartami',
    accent: '#f4142f',
    accent2: '#ffcf25',
    glow: 'rgba(244,20,47,0.34)',
    layout: 'reference',
  },
  {
    id: 2,
    label: 'Live Pulse',
    title: 'Live pulse',
    accent: '#ff293d',
    accent2: '#35f0b4',
    glow: 'rgba(53,240,180,0.24)',
    layout: 'live',
  },
  {
    id: 3,
    label: 'Boost Dock',
    title: 'Boost dock',
    accent: '#f10f2e',
    accent2: '#ffd42a',
    glow: 'rgba(255,212,42,0.26)',
    layout: 'boost',
  },
  {
    id: 4,
    label: 'Compact',
    title: 'Compact kupon',
    accent: '#e61028',
    accent2: '#70e2ff',
    glow: 'rgba(112,226,255,0.2)',
    layout: 'compact',
  },
  {
    id: 5,
    label: 'Misje',
    title: 'Mission rail',
    accent: '#ff1636',
    accent2: '#9cff63',
    glow: 'rgba(156,255,99,0.2)',
    layout: 'missions',
  },
  {
    id: 6,
    label: 'Casino',
    title: 'Sport + casino',
    accent: '#f3162f',
    accent2: '#d84cff',
    glow: 'rgba(216,76,255,0.22)',
    layout: 'casino',
  },
  {
    id: 7,
    label: 'Admin',
    title: 'Admin command',
    accent: '#ed1430',
    accent2: '#41d6ff',
    glow: 'rgba(65,214,255,0.18)',
    layout: 'admin',
  },
  {
    id: 8,
    label: 'Minimal',
    title: 'Minimal odds',
    accent: '#e8122b',
    accent2: '#f6c72d',
    glow: 'rgba(246,199,45,0.16)',
    layout: 'minimal',
  },
];

const roleTabs = [
  { key: 'dashboard', label: 'Panel', icon: Gauge },
  { key: 'manage', label: 'Zakłady', icon: ListChecks },
  { key: 'create', label: 'Dodaj', icon: BadgePlus },
  { key: 'proposals', label: 'Propozycje', icon: ClipboardCheck },
  { key: 'categories', label: 'Kategorie', icon: Layers3 },
] satisfies Array<{ key: string; label: string; icon: LucideIcon }>;

const splashVariants: Array<{
  id: SplashVariant;
  label: string;
  className: string;
}> = [
  { id: 1, label: 'Classic Flame', className: 'flame' },
  { id: 2, label: 'Neon Impact', className: 'neon' },
  { id: 3, label: 'Chrome Sport', className: 'chrome' },
  { id: 4, label: 'Arena Poster', className: 'arena' },
  { id: 5, label: 'Ultra Bold', className: 'ultra' },
];

const fallbackCategories: Category[] = [
  {
    id: 'fallback-football',
    name: 'Piłka nożna',
    emoji: '⚽',
    color: '#22c55e',
    sort_order: 1,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-basketball',
    name: 'Koszykówka',
    emoji: '🏀',
    color: '#f97316',
    sort_order: 2,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-tennis',
    name: 'Tenis',
    emoji: '🎾',
    color: '#eab308',
    sort_order: 3,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-esport',
    name: 'Esport',
    emoji: '🎮',
    color: '#8b5cf6',
    sort_order: 5,
    created_at: new Date(0).toISOString(),
  },
  {
    id: 'fallback-mma',
    name: 'MMA / Boks',
    emoji: '🥊',
    color: '#ef4444',
    sort_order: 6,
    created_at: new Date(0).toISOString(),
  },
];

function buildFallbackBets(): Bet[] {
  const now = Date.now();
  const hoursFromNow = (hours: number) => new Date(now + hours * 60 * 60 * 1000).toISOString();

  return [
    {
      id: 'fallback-bet-1',
      title: 'Kto wygra najbliższy mecz?',
      category_id: 'fallback-football',
      bet_type: '1x2',
      options: [
        { name: 'Gospodarze', odds: 1.82 },
        { name: 'Remis', odds: 3.35 },
        { name: 'Goście', odds: 2.14 },
      ],
      ends_at: hoursFromNow(5),
      is_live: false,
      is_bsplicboost: true,
      is_active: true,
      winning_option: null,
      bet_count: 18,
      created_at: hoursFromNow(-6),
    },
    {
      id: 'fallback-bet-2',
      title: 'Czy padnie więcej niż 2.5 gola?',
      category_id: 'fallback-football',
      bet_type: '12',
      options: [
        { name: 'Tak', odds: 1.74 },
        { name: 'Nie', odds: 1.98 },
      ],
      ends_at: hoursFromNow(3),
      is_live: true,
      is_bsplicboost: false,
      is_active: true,
      winning_option: null,
      bet_count: 27,
      created_at: hoursFromNow(-3),
    },
    {
      id: 'fallback-bet-3',
      title: 'Liczba punktów w meczu powyżej 160.5',
      category_id: 'fallback-basketball',
      bet_type: '12',
      options: [
        { name: 'Powyżej', odds: 1.91 },
        { name: 'Poniżej', odds: 1.86 },
      ],
      ends_at: hoursFromNow(9),
      is_live: false,
      is_bsplicboost: false,
      is_active: true,
      winning_option: null,
      bet_count: 11,
      created_at: hoursFromNow(-4),
    },
    {
      id: 'fallback-bet-4',
      title: 'Dokładny wynik pierwszego seta',
      category_id: 'fallback-tennis',
      bet_type: 'multi',
      options: [
        { name: '6:3', odds: 4.2 },
        { name: '6:4', odds: 3.7 },
        { name: '7:5', odds: 5.1 },
        { name: 'Tie-break', odds: 3.25 },
      ],
      ends_at: hoursFromNow(2),
      is_live: true,
      is_bsplicboost: true,
      is_active: true,
      winning_option: null,
      bet_count: 9,
      created_at: hoursFromNow(-2),
    },
    {
      id: 'fallback-bet-5',
      title: 'Pierwsza mapa: zwycięzca',
      category_id: 'fallback-esport',
      bet_type: '12',
      options: [
        { name: 'Team A', odds: 1.65 },
        { name: 'Team B', odds: 2.25 },
      ],
      ends_at: hoursFromNow(12),
      is_live: false,
      is_bsplicboost: false,
      is_active: true,
      winning_option: null,
      bet_count: 14,
      created_at: hoursFromNow(-7),
    },
    {
      id: 'fallback-bet-6',
      title: 'Walka zakończy się przed czasem',
      category_id: 'fallback-mma',
      bet_type: '12',
      options: [
        { name: 'Tak', odds: 1.58 },
        { name: 'Nie', odds: 2.35 },
      ],
      ends_at: hoursFromNow(22),
      is_live: false,
      is_bsplicboost: false,
      is_active: true,
      winning_option: null,
      bet_count: 7,
      created_at: hoursFromNow(-12),
    },
  ];
}

function useScrollChrome() {
  const [hidden, setHidden] = useState(false);
  const lastScrollTop = useRef(0);
  const scrollRef = useRef<HTMLElement | null>(null);

  const setChromeHidden = useCallback((nextHidden: boolean) => {
    setHidden(nextHidden);

    document
      .querySelectorAll('.proto-top-chrome, .proto-bottom-chrome')
      .forEach((element) => element.classList.toggle('is-hidden', nextHidden));
  }, []);

  const updateChromeVisibility = useCallback((current: number) => {
    const previous = lastScrollTop.current;

    if (current > previous + 10 && current > 82) {
      setChromeHidden(true);
    } else if (current < previous - 10 || current < 24) {
      setChromeHidden(false);
    }

    lastScrollTop.current = current;
  }, [setChromeHidden]);

  const handleNativeScroll = useCallback(() => {
    const current = scrollRef.current?.scrollTop ?? 0;
    updateChromeVisibility(current);
  }, [updateChromeVisibility]);

  useEffect(() => {
    const current = scrollRef.current;

    current?.addEventListener('scroll', handleNativeScroll, { passive: true });

    const interval = window.setInterval(() => {
      const current = scrollRef.current?.scrollTop ?? 0;

      if (current !== lastScrollTop.current) {
        updateChromeVisibility(current);
      }
    }, 80);

    return () => {
      current?.removeEventListener('scroll', handleNativeScroll);
      window.clearInterval(interval);
    };
  }, [handleNativeScroll, updateChromeVisibility]);

  const handleScroll = (event: UIEvent<HTMLElement>) => {
    updateChromeVisibility(event.currentTarget.scrollTop);
  };

  return { hidden, handleScroll, scrollRef };
}

function usePrototypeAdminMetrics(role: PrototypeRole) {
  const [metrics, setMetrics] = useState<AdminMetrics>({
    pendingProposals: 0,
    placedBets: 0,
    totalPool: 0,
    recentResolved: [],
  });

  useEffect(() => {
    if (role !== 'admin') {
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const [
          placedResult,
          stakeResult,
          proposalsResult,
          recentResolvedResult,
        ] = await Promise.all([
          supabase.from('placed_bets').select('*', { count: 'exact', head: true }),
          supabase.from('placed_bets').select('stake'),
          supabase
            .from('bet_proposals')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending'),
          supabase
            .from('bets')
            .select('id, title, winning_option, created_at')
            .not('winning_option', 'is', null)
            .order('created_at', { ascending: false })
            .limit(4),
        ]);

        if (!mounted) {
          return;
        }

        const totalPool =
          stakeResult.data?.reduce((sum, row) => sum + Number(row.stake), 0) ?? 0;

        setMetrics({
          pendingProposals: proposalsResult.count ?? 0,
          placedBets: placedResult.count ?? 0,
          totalPool,
          recentResolved: (recentResolvedResult.data ?? []) as AdminMetrics['recentResolved'],
        });
      } catch {
        if (mounted) {
          setMetrics({
            pendingProposals: 0,
            placedBets: 0,
            totalPool: 0,
            recentResolved: [],
          });
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [role]);

  return metrics;
}

function sortPrototypeBets(bets: Bet[], sort: SortMode) {
  const next = [...bets];

  if (sort === 'popular') {
    return next.sort((a, b) => b.bet_count - a.bet_count);
  }

  if (sort === 'ending_soon') {
    return next.sort(
      (a, b) => new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime(),
    );
  }

  return next.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function buildCategoryMap(categories: Category[]) {
  return categories.reduce<Record<string, Category>>((map, category) => {
    map[category.id] = category;
    return map;
  }, {});
}

function usePrototypeData(sort: SortMode) {
  const [categories, setCategories] = useState<Category[]>(fallbackCategories);
  const [bets, setBets] = useState<Bet[]>(() => sortPrototypeBets(buildFallbackBets(), sort));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);

      try {
        const [{ data: categoryRows, error: categoryError }, { data: betRows, error: betError }] =
          await Promise.all([
            supabase.from('categories').select('*').order('sort_order'),
            supabase.from('bets').select('*').eq('is_active', true),
          ]);

        if (categoryError || betError) {
          throw categoryError ?? betError;
        }

        if (!mounted) {
          return;
        }

        const realCategories = (categoryRows ?? []) as Category[];
        const realBets = (betRows ?? []) as unknown as Bet[];

        setCategories(realCategories.length > 0 ? realCategories : fallbackCategories);
        setBets(
          sortPrototypeBets(
            realBets.length > 0 ? realBets : buildFallbackBets(),
            sort,
          ),
        );
      } catch {
        if (mounted) {
          setCategories(fallbackCategories);
          setBets(sortPrototypeBets(buildFallbackBets(), sort));
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
  }, [sort]);

  return {
    categories,
    categoryMap: useMemo(() => buildCategoryMap(categories), [categories]),
    bets,
    liveBets: useMemo(() => bets.filter((bet) => bet.is_live), [bets]),
    loading,
  };
}

function formatMoney(value: number | null | undefined) {
  return `${Number(value ?? 0).toFixed(2)} zł`;
}

function formatOdd(value: number | null | undefined) {
  if (!Number.isFinite(Number(value))) {
    return '-';
  }

  return Number(value).toFixed(2).replace('.', ',');
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--.-- --:--';
  }

  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(date)
    .replace(',', '');
}

function getBetOptions(bet: Bet) {
  return Array.isArray(bet.options) ? (bet.options as BetOption[]) : [];
}

function getCategory(bet: Bet, categoryMap: Record<string, Category>) {
  return bet.category_id ? categoryMap[bet.category_id] : undefined;
}

function getFirstOption(bet: Bet) {
  return getBetOptions(bet)[0] ?? null;
}

function getBestOption(bet: Bet) {
  const options = getBetOptions(bet);
  return options.reduce<BetOption | null>((best, option) => {
    if (!best || Number(option.odds) > Number(best.odds)) {
      return option;
    }
    return best;
  }, null);
}

function filterByCategory(bets: Bet[], selectedCategory: string | null) {
  if (!selectedCategory) {
    return bets;
  }

  return bets.filter((bet) => bet.category_id === selectedCategory);
}

function sortForVariant(variant: PrototypeVariant): SortMode {
  if (variant.layout === 'live' || variant.layout === 'compact') {
    return 'ending_soon';
  }

  if (variant.layout === 'boost' || variant.layout === 'minimal') {
    return 'popular';
  }

  return 'newest';
}

function AnimatedBlock({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SplashScreen({
  variant,
  onDone,
}: {
  variant: SplashVariant;
  onDone: () => void;
}) {
  const splash = splashVariants.find((item) => item.id === variant) ?? splashVariants[0];

  useEffect(() => {
    const timeout = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(timeout);
  }, [onDone]);

  return (
    <motion.div
      className={cn('proto-splash', `proto-splash-${splash.className}`)}
      data-splash={variant}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.34, ease: 'easeOut' }}
    >
      <div className="proto-splash-pattern" />
      <motion.div
        className="proto-splash-logo"
        initial={{ opacity: 0, y: 16, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.18, duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
      >
        BSPLIC
      </motion.div>
      <motion.div
        className="proto-splash-sponsors"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.52, duration: 0.44 }}
      >
        <p>Oficjalny Sponsor</p>
        <strong className="proto-splash-yahu">Big Yahu</strong>
        <span>{splash.label}</span>
      </motion.div>
    </motion.div>
  );
}

function StatusPills({
  role,
  profile,
  stats,
}: {
  role: PrototypeRole;
  profile: Profile | null;
  stats: PrototypeStats;
}) {
  if (role === 'admin') {
    return (
      <>
        <span className="proto-admin-chip">
          <ShieldCheck />
          Admin
        </span>
        <span className="proto-counter-chip">{stats.pendingProposals} prop.</span>
      </>
    );
  }

  return (
    <>
      <button className="proto-wallet" type="button">
        <CircleDollarSign />
        {formatMoney(profile?.balance)}
      </button>
      <button className="proto-deposit" type="button">
        <Plus />
        100 zł
      </button>
    </>
  );
}

function CategoryRail({
  categories,
  selectedCategory,
  onSelectCategory,
  role,
}: {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  role: PrototypeRole;
}) {
  if (role === 'admin') {
    return (
      <div className="proto-chip-rail">
        {roleTabs.map(({ label, icon: Icon }, index) => (
          <button
            key={label}
            className={cn('proto-category-chip', index === 0 && 'is-active')}
            type="button"
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
    );
  }

  const chips = [
    { id: null, emoji: '✦', name: 'Wszystkie' },
    ...categories.slice(0, 7),
  ];

  return (
    <div className="proto-chip-rail">
      {chips.map((category) => {
        const isActive = selectedCategory === category.id;

        return (
          <button
            key={category.id ?? 'all'}
            onClick={() => onSelectCategory(category.id)}
            className={cn('proto-category-chip', isActive && 'is-active')}
            type="button"
          >
            <span className="proto-chip-emoji">{category.emoji}</span>
            {category.name}
          </button>
        );
      })}
    </div>
  );
}

function TopChrome({
  role,
  hidden,
  variant,
  profile,
  categories,
  selectedCategory,
  onSelectCategory,
  stats,
}: {
  role: PrototypeRole;
  hidden: boolean;
  variant: PrototypeVariant;
  profile: Profile | null;
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  stats: PrototypeStats;
}) {
  const activeCategory = categories.find((category) => category.id === selectedCategory);
  const isAdmin = role === 'admin';
  const topClassName = cn(
    'proto-top-chrome',
    `proto-top-v${variant.id}`,
    isAdmin && 'is-admin',
    hidden && 'is-hidden',
  );

  const chrome = (children: ReactNode) => (
    <motion.header
      className={topClassName}
      animate={{ y: hidden ? '-112%' : 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="proto-top-pattern" />
      {children}
    </motion.header>
  );

  if (variant.id === 2) {
    return chrome(
      <>
        <div className="proto-top-row proto-top-score-row">
          <div className="proto-live-chip">
            <Radio />
            {stats.liveBets} live
          </div>
          <strong>{isAdmin ? 'Kontrola aktywności' : 'Najszybszy widok zdarzeń'}</strong>
          <StatusPills role={role} profile={profile} stats={stats} />
        </div>
        <CategoryRail
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          role={role}
        />
      </>,
    );
  }

  if (variant.id === 3) {
    return chrome(
      <>
        <div className="proto-search-top">
          <Link to="/" className="proto-brand" aria-label="Bsplic home">
            BSPLIC
          </Link>
          <button className="proto-search-pill" type="button">
            <Search />
            <span>{activeCategory ? activeCategory.name : 'Szukaj zakładu'}</span>
          </button>
          <StatusPills role={role} profile={profile} stats={stats} />
        </div>
        <CategoryRail
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          role={role}
        />
      </>,
    );
  }

  if (variant.id === 4) {
    return chrome(
      <div className="proto-compact-top">
        <Link to="/" className="proto-mini-brand" aria-label="Bsplic home">
          B
        </Link>
        <CategoryRail
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          role={role}
        />
        <button className="proto-square-action" type="button" aria-label="Filtry">
          <SlidersHorizontal />
        </button>
      </div>,
    );
  }

  if (variant.id === 5) {
    return chrome(
      <>
        <div className="proto-mission-top">
          <div>
            <span>{isAdmin ? 'Kolejka admina' : 'Misje i kupon'}</span>
            <strong>
              {isAdmin
                ? `${stats.pendingProposals} propozycji`
                : `${stats.couponItems} zdarzeń w kuponie`}
            </strong>
          </div>
          <div className="proto-mission-meter">
            <b>{Math.min(99, stats.activeBets)}</b>
            <small>aktywnych</small>
          </div>
        </div>
        <CategoryRail
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          role={role}
        />
      </>,
    );
  }

  if (variant.id === 6) {
    return chrome(
      <>
        <div className="proto-casino-top">
          <Link to="/" className="proto-brand" aria-label="Bsplic home">
            BSPLIC
          </Link>
          <div className="proto-mode-switch">
            <button type="button" className="is-active">
              Sport
            </button>
            <button type="button">Casino</button>
          </div>
          <StatusPills role={role} profile={profile} stats={stats} />
        </div>
        <CategoryRail
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          role={role}
        />
      </>,
    );
  }

  if (variant.id === 7) {
    return chrome(
      <>
        <div className="proto-admin-command-top">
          <div>
            <span>{isAdmin ? 'Admin command' : 'Szybkie zakłady'}</span>
            <strong>{isAdmin ? 'Operacje' : 'BSPLIC'}</strong>
          </div>
          <div className="proto-admin-top-metrics">
            <article>
              <b>{stats.activeBets}</b>
              <span>aktywne</span>
            </article>
            <article>
              <b>{stats.pendingProposals}</b>
              <span>prop.</span>
            </article>
            <article>
              <b>{stats.categoryCount}</b>
              <span>kat.</span>
            </article>
          </div>
        </div>
        <CategoryRail
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
          role={role}
        />
      </>,
    );
  }

  if (variant.id === 8) {
    return chrome(
      <div className="proto-minimal-top">
        <Link to="/" className="proto-minimal-brand" aria-label="Bsplic home">
          BSPLIC
        </Link>
        <button className="proto-minimal-filter" type="button">
          {activeCategory ? `${activeCategory.emoji} ${activeCategory.name}` : 'Wszystkie'}
        </button>
        <StatusPills role={role} profile={profile} stats={stats} />
      </div>,
    );
  }

  return chrome(
    <>
      <div className="proto-top-row">
        <Link to="/" className="proto-brand" aria-label="Bsplic home">
          BSPLIC
        </Link>
        <div className="proto-top-actions">
          <StatusPills role={role} profile={profile} stats={stats} />
          <button className="proto-square-action" type="button" aria-label="Powiadomienia">
            <Bell />
            {stats.couponItems > 0 && <span>{stats.couponItems}</span>}
          </button>
          <button className="proto-avatar" type="button" aria-label="Profil">
            <UserRound />
          </button>
        </div>
      </div>
      <CategoryRail
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
        role={role}
      />
    </>,
  );
}

function buildUserNav(stats: PrototypeStats): NavItem[] {
  return [
    { label: 'Zakłady', icon: Home, active: true },
    { label: 'Live', icon: Radio, badge: String(stats.liveBets) },
    { label: 'Kupon', icon: Ticket, badge: String(stats.couponItems), emphasis: true },
    { label: 'Social', icon: Star },
    { label: 'Kasyno', icon: Gamepad2 },
  ];
}

function buildAdminNav(stats: PrototypeStats): NavItem[] {
  return [
    { label: 'Panel', icon: Gauge, active: true },
    { label: 'Zakłady', icon: ListChecks, badge: String(stats.activeBets) },
    { label: 'Dodaj', icon: BadgePlus, emphasis: true },
    { label: 'Propozycje', icon: ClipboardCheck, badge: String(stats.pendingProposals) },
    { label: 'Opcje', icon: Settings },
  ];
}

function BottomButton({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      className={cn(
        'proto-bottom-item',
        item.active && 'is-active',
        item.emphasis && 'is-center',
      )}
    >
      <span className="proto-bottom-icon">
        <Icon />
        {item.badge && item.badge !== '0' && <em>{item.badge}</em>}
      </span>
      <span>{item.label}</span>
    </button>
  );
}

function BottomChrome({
  role,
  hidden,
  variant,
  stats,
}: {
  role: PrototypeRole;
  hidden: boolean;
  variant: PrototypeVariant;
  stats: PrototypeStats;
}) {
  const items = role === 'admin' ? buildAdminNav(stats) : buildUserNav(stats);
  const className = cn(
    'proto-bottom-chrome',
    `proto-bottom-v${variant.id}`,
    role === 'admin' && 'is-admin',
    hidden && 'is-hidden',
  );

  const chrome = (children: ReactNode) => (
    <motion.nav
      className={className}
      animate={{ y: hidden ? '118%' : 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.nav>
  );

  if (variant.id === 2) {
    return chrome(
      <>
        <BottomButton item={items[0]} />
        <BottomButton item={items[1]} />
        <button className="proto-live-dock-action" type="button">
          <Radio />
          <span>{stats.liveBets} live</span>
        </button>
        <BottomButton item={items[3]} />
        <BottomButton item={items[4]} />
      </>,
    );
  }

  if (variant.id === 3) {
    return chrome(
      <div className="proto-slip-dock">
        <button type="button">
          <Home />
          <span>Start</span>
        </button>
        <button type="button" className="is-primary">
          <Ticket />
          <span>
            {stats.couponItems} zdarzeń
            <b>{formatOdd(stats.couponOdds)}</b>
          </span>
        </button>
        <button type="button">
          <UserRound />
          <span>Profil</span>
        </button>
      </div>,
    );
  }

  if (variant.id === 4) {
    return chrome(
      <div className="proto-icon-strip">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={cn(item.active && 'is-active')}>
              <Icon />
              {item.badge && item.badge !== '0' && <em>{item.badge}</em>}
            </button>
          );
        })}
      </div>,
    );
  }

  if (variant.id === 5) {
    return chrome(
      <div className="proto-progress-dock">
        <div>
          <span>{role === 'admin' ? 'Propozycje' : 'Kupon'}</span>
          <strong>
            {role === 'admin'
              ? `${stats.pendingProposals} oczekuje`
              : `${stats.couponItems} / ${Math.max(3, stats.couponItems)} zdarzeń`}
          </strong>
        </div>
        <button type="button">{role === 'admin' ? 'Otwórz' : 'Obstaw'}</button>
      </div>,
    );
  }

  if (variant.id === 6) {
    return chrome(
      <div className="proto-casino-dock">
        <button type="button" className="is-active">
          <Home />
          Sport
        </button>
        <button type="button">
          <Gamepad2 />
          Casino
        </button>
        <button type="button">
          <Ticket />
          Kupon {stats.couponItems}
        </button>
      </div>,
    );
  }

  if (variant.id === 7) {
    return chrome(
      <div className="proto-admin-dock">
        {items.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={cn(item.emphasis && 'is-primary')}>
              <Icon />
              <span>{item.label}</span>
              {item.badge && item.badge !== '0' && <b>{item.badge}</b>}
            </button>
          );
        })}
      </div>,
    );
  }

  if (variant.id === 8) {
    return chrome(
      <div className="proto-floating-tabs">
        {items.slice(0, 4).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.label} type="button" className={cn(item.active && 'is-active')}>
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>,
    );
  }

  return chrome(items.map((item) => <BottomButton key={item.label} item={item} />));
}

function PrototypeSwitcher({
  variant,
  role,
  splashVariant,
  onVariantChange,
  onRoleChange,
  onSplashVariantChange,
  onReplaySplash,
}: {
  variant: PrototypeVariant;
  role: PrototypeRole;
  splashVariant: SplashVariant;
  onVariantChange: (id: number) => void;
  onRoleChange: (role: PrototypeRole) => void;
  onSplashVariantChange: (variant: SplashVariant) => void;
  onReplaySplash: () => void;
}) {
  return (
    <div className="proto-switcher">
      <div className="proto-switcher-variants">
        {variants.map((item) => (
          <button
            key={item.id}
            onClick={() => onVariantChange(item.id)}
            className={cn(item.id === variant.id && 'is-active')}
            title={item.label}
            type="button"
          >
            {item.id}
          </button>
        ))}
      </div>
      <div className="proto-switcher-splashes">
        {splashVariants.map((item) => (
          <button
            key={item.id}
            onClick={() => onSplashVariantChange(item.id)}
            className={cn(item.id === splashVariant && 'is-active')}
            title={item.label}
            type="button"
          >
            S{item.id}
          </button>
        ))}
      </div>
      <div className="proto-switcher-actions">
        <button
          onClick={() => onRoleChange(role === 'user' ? 'admin' : 'user')}
          className="proto-role-toggle"
          type="button"
        >
          {role === 'user' ? 'User' : 'Admin'}
        </button>
        <button onClick={onReplaySplash} type="button">
          Splash
        </button>
      </div>
    </div>
  );
}

function RealOddsButton({
  bet,
  option,
  compact = false,
}: {
  bet: Bet;
  option: BetOption;
  compact?: boolean;
}) {
  const { items, addItem, removeItem } = useCoupon();
  const selectedInCoupon = items.find((item) => item.bet.id === bet.id);
  const isSelected = selectedInCoupon?.selectedOption === option.name;
  const isExpired = new Date(bet.ends_at).getTime() <= Date.now();

  const handleSelect = () => {
    if (isExpired || !bet.is_active) {
      return;
    }

    if (isSelected) {
      removeItem(bet.id);
      return;
    }

    addItem({ bet, selectedOption: option.name, odds: Number(option.odds) });
  };

  return (
    <button
      type="button"
      onClick={handleSelect}
      disabled={isExpired || !bet.is_active}
      className={cn('proto-real-odd', isSelected && 'is-selected', compact && 'is-compact')}
    >
      <span>{option.name}</span>
      <strong>{formatOdd(option.odds)}</strong>
    </button>
  );
}

function EventPoster({
  bet,
  category,
  variant,
}: {
  bet: Bet;
  category?: Category;
  variant: PrototypeVariant;
}) {
  const options = getBetOptions(bet).slice(0, 3);
  const bestOption = getBestOption(bet);

  return (
    <article
      className="proto-event-poster"
      style={{ '--category-color': category?.color || variant.accent } as CSSProperties}
    >
      <div className="proto-event-art">
        <span>{category?.emoji ?? '✦'}</span>
        <div>
          {bet.is_live && <b>LIVE</b>}
          {bet.is_bsplicboost && <b>BOOST</b>}
        </div>
      </div>
      <div className="proto-event-body">
        <div className="proto-real-meta">
          <span>{category?.name ?? 'Zakład'}</span>
          <em>
            <Timer /> {formatShortDate(bet.ends_at)}
          </em>
        </div>
        <h2>{bet.title}</h2>
        {bestOption && (
          <p>
            Najwyższy kurs: <strong>{bestOption.name}</strong>{' '}
            <b>{formatOdd(bestOption.odds)}</b>
          </p>
        )}
        <div className="proto-real-odds-grid">
          {options.map((option) => (
            <RealOddsButton key={option.name} bet={bet} option={option} />
          ))}
        </div>
      </div>
    </article>
  );
}

function RealBetCard({
  bet,
  category,
  variant,
  mode = 'card',
}: {
  bet: Bet;
  category?: Category;
  variant: PrototypeVariant;
  mode?: 'card' | 'row' | 'minimal';
}) {
  const options = getBetOptions(bet);

  if (mode === 'row') {
    const firstOption = getFirstOption(bet);

    return (
      <article className="proto-real-row">
        <div className="proto-row-token" style={{ background: category?.color || variant.accent }}>
          {category?.emoji ?? '✦'}
        </div>
        <div>
          <span>{category?.name ?? 'Zakład'} · {formatShortDate(bet.ends_at)}</span>
          <strong>{bet.title}</strong>
        </div>
        {firstOption && <RealOddsButton bet={bet} option={firstOption} compact />}
      </article>
    );
  }

  return (
    <article className={cn('proto-real-card', mode === 'minimal' && 'is-minimal')}>
      <div className="proto-real-meta">
        <span>
          {category?.emoji ?? '✦'} {category?.name ?? 'Zakład'}
        </span>
        <em>
          <Timer /> {formatShortDate(bet.ends_at)}
        </em>
      </div>
      <h3>{bet.title}</h3>
      <div className="proto-real-flags">
        {bet.is_live && <span>LIVE</span>}
        {bet.is_bsplicboost && <span>BOOST</span>}
        <span>{bet.bet_count} kuponów</span>
      </div>
      <div className="proto-real-odds-grid">
        {options.slice(0, mode === 'minimal' ? 2 : 6).map((option) => (
          <RealOddsButton key={option.name} bet={bet} option={option} compact={mode === 'minimal'} />
        ))}
      </div>
    </article>
  );
}

function EmptyRealData({ loading }: { loading: boolean }) {
  return (
    <section className="proto-empty-real">
      <Sparkles />
      <strong>{loading ? 'Ładowanie realnych zakładów' : 'Brak aktywnych zakładów w bazie'}</strong>
      <span>
        Prototyp celowo nie używa już podstawionych zdjęć ani nazw wydarzeń.
      </span>
    </section>
  );
}

function PromoBanner({
  variant,
  stats,
  profile,
}: {
  variant: PrototypeVariant;
  stats: PrototypeStats;
  profile: Profile | null;
}) {
  return (
    <section className="proto-promo">
      <div className="proto-promo-icon">
        <Sparkles />
      </div>
      <div>
        <p>{variant.layout === 'missions' ? 'Misje dnia' : 'Prawdziwy feed'}</p>
        <span>
          {stats.activeBets} aktywnych · {stats.boostBets} boost · saldo{' '}
          {formatMoney(profile?.balance)}
        </span>
      </div>
      <button type="button" aria-label="Więcej informacji">
        <Menu />
      </button>
    </section>
  );
}

function RealBetStack({
  bets,
  categoryMap,
  variant,
  title = 'Aktywne zakłady',
  mode = 'card',
}: {
  bets: Bet[];
  categoryMap: Record<string, Category>;
  variant: PrototypeVariant;
  title?: string;
  mode?: 'card' | 'row' | 'minimal';
}) {
  if (bets.length === 0) {
    return null;
  }

  return (
    <section className={cn('proto-section', mode === 'row' && 'proto-row-section')}>
      <h2>{title}</h2>
      <div className={cn('proto-real-stack', mode === 'row' && 'is-row')}>
        {bets.map((bet, index) => (
          <AnimatedBlock key={bet.id} delay={index * 0.035}>
            <RealBetCard
              bet={bet}
              category={getCategory(bet, categoryMap)}
              variant={variant}
              mode={mode}
            />
          </AnimatedBlock>
        ))}
      </div>
    </section>
  );
}

function AdminCommandContent({
  bets,
  categoryMap,
  variant,
  stats,
  adminMetrics,
}: {
  bets: Bet[];
  categoryMap: Record<string, Category>;
  variant: PrototypeVariant;
  stats: PrototypeStats;
  adminMetrics: AdminMetrics;
}) {
  const queue = bets.slice(0, 4);

  return (
    <>
      <AnimatedBlock>
        <section className="proto-admin-dashboard">
          <div className="proto-admin-dashboard-head">
            <div>
              <span>Panel Admina</span>
              <h1>Operacje na realnych danych</h1>
            </div>
            <ShieldCheck />
          </div>
          <div className="proto-admin-metrics">
            <article>
              <strong>{stats.activeBets}</strong>
              <span>Aktywne zakłady</span>
            </article>
            <article>
              <strong>{stats.pendingProposals}</strong>
              <span>Propozycje</span>
            </article>
            <article>
              <strong>{formatMoney(adminMetrics.totalPool)}</strong>
              <span>Łączna pula</span>
            </article>
          </div>
        </section>
      </AnimatedBlock>

      {adminMetrics.recentResolved.length > 0 && (
        <AnimatedBlock delay={0.05}>
          <section className="proto-admin-queue">
            <h2>Ostatnio rozstrzygnięte</h2>
            {adminMetrics.recentResolved.map((item, index) => (
              <article key={item.id}>
                <span>{index + 1}</span>
                <strong>{item.title}</strong>
                <button type="button">{item.winning_option ?? 'Wynik'}</button>
              </article>
            ))}
          </section>
        </AnimatedBlock>
      )}

      <RealBetStack
        bets={queue}
        categoryMap={categoryMap}
        variant={variant}
        title="Kolejka zakładów"
        mode="row"
      />
    </>
  );
}

function MissionContent({
  bets,
  categoryMap,
  variant,
  stats,
  profile,
}: {
  bets: Bet[];
  categoryMap: Record<string, Category>;
  variant: PrototypeVariant;
  stats: PrototypeStats;
  profile: Profile | null;
}) {
  const missionRows = [
    {
      label: 'Kupon',
      value: `${stats.couponItems} zdarzeń`,
      detail: `kurs ${formatOdd(stats.couponOdds)}`,
    },
    {
      label: 'Seria',
      value: `${profile?.current_streak ?? 0}`,
      detail: `rekord ${profile?.longest_streak ?? 0}`,
    },
    {
      label: 'Boosty',
      value: `${stats.boostBets}`,
      detail: 'aktywne teraz',
    },
  ];

  return (
    <>
      <AnimatedBlock>
        <section className="proto-mission-grid">
          {missionRows.map((item) => (
            <article key={item.label}>
              <CheckCircle2 />
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              <em>{item.value}</em>
            </article>
          ))}
        </section>
      </AnimatedBlock>
      <RealBetStack
        bets={bets.slice(0, 6)}
        categoryMap={categoryMap}
        variant={variant}
        title="Misje z realnych zdarzeń"
        mode="card"
      />
    </>
  );
}

function CasinoContent({
  bets,
  categoryMap,
  variant,
  stats,
}: {
  bets: Bet[];
  categoryMap: Record<string, Category>;
  variant: PrototypeVariant;
  stats: PrototypeStats;
}) {
  return (
    <>
      <AnimatedBlock>
        <section className="proto-casino-panel">
          <div>
            <span>Casino crossover</span>
            <h2>Sport zostaje realny, casino jest tylko skrótem do modułu</h2>
            <p>{stats.activeBets} aktywnych zdarzeń w sportsbooku</p>
          </div>
          <div className="proto-casino-actions">
            <Link to="/casino/roulette">Ruletka</Link>
            <Link to="/casino/blackjack">Blackjack</Link>
          </div>
        </section>
      </AnimatedBlock>
      <RealBetStack
        bets={bets.slice(0, 5)}
        categoryMap={categoryMap}
        variant={variant}
        title="Sport pod spodem"
        mode="minimal"
      />
    </>
  );
}

function VariantContent({
  variant,
  role,
  loading,
  bets,
  liveBets,
  boostBets,
  categoryMap,
  stats,
  adminMetrics,
  profile,
}: {
  variant: PrototypeVariant;
  role: PrototypeRole;
  loading: boolean;
  bets: Bet[];
  liveBets: Bet[];
  boostBets: Bet[];
  categoryMap: Record<string, Category>;
  stats: PrototypeStats;
  adminMetrics: AdminMetrics;
  profile: Profile | null;
}) {
  if (loading || bets.length === 0) {
    return <EmptyRealData loading={loading} />;
  }

  if (variant.layout === 'admin' || role === 'admin') {
    return (
      <AdminCommandContent
        bets={bets}
        categoryMap={categoryMap}
        variant={variant}
        stats={stats}
        adminMetrics={adminMetrics}
      />
    );
  }

  if (variant.layout === 'live') {
    return (
      <>
        <AnimatedBlock>
          <section className="proto-live-hero">
            <div>
              <span>LIVE TERAZ</span>
              <h1>{liveBets.length || bets.length} zdarzeń do szybkiego grania</h1>
            </div>
            <Activity />
          </section>
        </AnimatedBlock>
        <RealBetStack
          bets={(liveBets.length > 0 ? liveBets : bets).slice(0, 7)}
          categoryMap={categoryMap}
          variant={variant}
          title={liveBets.length > 0 ? 'Live z bazy' : 'Najbliższe zdarzenia'}
          mode="row"
        />
      </>
    );
  }

  if (variant.layout === 'boost') {
    const featured = boostBets[0] ?? bets[0];

    return (
      <>
        <AnimatedBlock>
          <EventPoster
            bet={featured}
            category={getCategory(featured, categoryMap)}
            variant={variant}
          />
        </AnimatedBlock>
        <RealBetStack
          bets={(boostBets.length > 1 ? boostBets.slice(1) : bets.slice(1)).slice(0, 5)}
          categoryMap={categoryMap}
          variant={variant}
          title={boostBets.length > 1 ? 'Boosty z bazy' : 'Popularne z bazy'}
          mode="card"
        />
      </>
    );
  }

  if (variant.layout === 'compact') {
    return (
      <>
        <AnimatedBlock>
          <PromoBanner variant={variant} stats={stats} profile={profile} />
        </AnimatedBlock>
        <RealBetStack
          bets={bets.slice(0, 10)}
          categoryMap={categoryMap}
          variant={variant}
          title="Kompaktowa lista"
          mode="row"
        />
      </>
    );
  }

  if (variant.layout === 'missions') {
    return (
      <MissionContent
        bets={bets}
        categoryMap={categoryMap}
        variant={variant}
        stats={stats}
        profile={profile}
      />
    );
  }

  if (variant.layout === 'casino') {
    return (
      <CasinoContent
        bets={bets}
        categoryMap={categoryMap}
        variant={variant}
        stats={stats}
      />
    );
  }

  if (variant.layout === 'minimal') {
    return (
      <>
        <AnimatedBlock>
          <section className="proto-minimal-lead">
            <span>Popularne</span>
            <h1>Bez zdjęć, tylko realne zdarzenia i kursy</h1>
            <p>Ten wariant pokazuje, jak może wyglądać feed bez wsparcia zdjęć dla betów.</p>
          </section>
        </AnimatedBlock>
        <RealBetStack
          bets={bets.slice(0, 8)}
          categoryMap={categoryMap}
          variant={variant}
          title="Minimal odds"
          mode="minimal"
        />
      </>
    );
  }

  return (
    <>
      <AnimatedBlock>
        <PromoBanner variant={variant} stats={stats} profile={profile} />
      </AnimatedBlock>
      <AnimatedBlock delay={0.04}>
        <EventPoster
          bet={bets[0]}
          category={getCategory(bets[0], categoryMap)}
          variant={variant}
        />
      </AnimatedBlock>
      <RealBetStack
        bets={bets.slice(1, 7)}
        categoryMap={categoryMap}
        variant={variant}
        title="Feed z bazy"
        mode="card"
      />
    </>
  );
}

export default function BetclicHomePrototypes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hidden, handleScroll, scrollRef } = useScrollChrome();
  const [showSplash, setShowSplash] = useState(
    () => searchParams.get('splash') !== '0',
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { profile } = useAuth();
  const { items, totalOdds } = useCoupon();

  const selectedVariant = useMemo(() => {
    const variantId = Number(searchParams.get('variant') ?? '1');
    return variants.find((variant) => variant.id === variantId) ?? variants[0];
  }, [searchParams]);

  const selectedSplashVariant = useMemo<SplashVariant>(() => {
    const splashId = Number(searchParams.get('splash') ?? '1');
    return splashVariants.some((item) => item.id === splashId)
      ? (splashId as SplashVariant)
      : 1;
  }, [searchParams]);

  const role: PrototypeRole =
    searchParams.get('role') === 'admin' ? 'admin' : 'user';

  const sort = useMemo(() => sortForVariant(selectedVariant), [selectedVariant]);
  const {
    categories,
    categoryMap,
    loading: dataLoading,
    bets: allBets,
    liveBets,
  } = usePrototypeData(sort);
  const adminMetrics = usePrototypeAdminMetrics(role);

  const visibleLiveBets = useMemo(
    () => filterByCategory(liveBets, selectedCategory),
    [liveBets, selectedCategory],
  );

  const visibleBets = useMemo(
    () => filterByCategory(allBets, selectedCategory),
    [allBets, selectedCategory],
  );

  const boostBets = useMemo(
    () => visibleBets.filter((bet) => bet.is_bsplicboost),
    [visibleBets],
  );

  const stats: PrototypeStats = useMemo(
    () => ({
      activeBets: allBets.length,
      liveBets: liveBets.length,
      boostBets: allBets.filter((bet) => bet.is_bsplicboost).length,
      categoryCount: categories.length,
      couponItems: items.length,
      couponOdds: items.length > 0 ? totalOdds : 0,
      pendingProposals: adminMetrics.pendingProposals,
      placedBets: adminMetrics.placedBets,
      totalPool: adminMetrics.totalPool,
    }),
    [allBets, liveBets, categories.length, items.length, totalOdds, adminMetrics],
  );

  const setParam = (next: {
    variant?: number;
    role?: PrototypeRole;
    splash?: SplashVariant;
  }) => {
    const updated = new URLSearchParams(searchParams);
    if (next.variant) updated.set('variant', String(next.variant));
    if (next.role) updated.set('role', next.role);
    if (next.splash) updated.set('splash', String(next.splash));
    setSearchParams(updated, { replace: true });
  };

  const style = {
    '--proto-accent': selectedVariant.accent,
    '--proto-accent-2': selectedVariant.accent2,
    '--proto-glow': selectedVariant.glow,
  } as CSSProperties;

  return (
    <div
      className="betclic-prototype-page"
      data-variant={selectedVariant.layout}
      data-role={role}
      style={style}
    >
      <AnimatePresence>
        {showSplash && (
          <SplashScreen
            variant={selectedSplashVariant}
            onDone={() => setShowSplash(false)}
          />
        )}
      </AnimatePresence>

      <TopChrome
        role={role}
        hidden={hidden}
        variant={selectedVariant}
        profile={profile}
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        stats={stats}
      />

      <main ref={scrollRef} className="proto-scroll" onScroll={handleScroll}>
        <div className="proto-content">
          <div className="proto-variant-title">
            <span>V{selectedVariant.id}</span>
            <h1>{selectedVariant.title}</h1>
          </div>
          <VariantContent
            variant={selectedVariant}
            role={role}
            loading={dataLoading}
            bets={visibleBets}
            liveBets={visibleLiveBets}
            boostBets={boostBets}
            categoryMap={categoryMap}
            stats={stats}
            adminMetrics={adminMetrics}
            profile={profile}
          />
        </div>
      </main>

      <BottomChrome
        role={role}
        hidden={hidden}
        variant={selectedVariant}
        stats={stats}
      />

      <PrototypeSwitcher
        variant={selectedVariant}
        role={role}
        splashVariant={selectedSplashVariant}
        onVariantChange={(id) => setParam({ variant: id })}
        onRoleChange={(nextRole) => setParam({ role: nextRole })}
        onSplashVariantChange={(nextSplash) => {
          setParam({ splash: nextSplash });
          setShowSplash(true);
        }}
        onReplaySplash={() => setShowSplash(true)}
      />
    </div>
  );
}
