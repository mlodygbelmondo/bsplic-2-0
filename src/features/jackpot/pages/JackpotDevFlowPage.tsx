import { useCallback, useMemo, useState } from 'react';
import { RotateCcw, SkipForward } from 'lucide-react';

import { BetListView } from '@/components/BetList';
import { CategorySidebar } from '@/components/CategorySidebar';
import { CouponDrawer } from '@/components/CouponDrawer';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Bet, Category } from '@/types/database';

import { DailyJackpotCard } from '../components/DailyJackpotCard';
import { JackpotDrawExperience } from './JackpotDrawPage';
import type {
  DailyJackpotClaimResult,
  DailyJackpotDraw,
  DailyJackpotParticipant,
  DailyJackpotRewardCreditStatus,
  DailyJackpotSnapshot,
  DailyJackpotStatus,
} from '../types';

const DEV_USER_ID = 'dev-user';
const DEV_POOL_ID = 'dev-active-jackpot-pool';
const DEV_NOW = '2026-06-20T10:35:44.000Z';
const DEV_DRAW_AT = '2026-06-20T18:00:00.000Z';

type DevScreen = 'home' | 'draw';

const categories: Category[] = [
  {
    id: 'football',
    name: 'Piłka nożna',
    emoji: '⚽',
    color: '#16a34a',
    sort_order: 1,
    created_at: DEV_NOW,
  },
  {
    id: 'youtube',
    name: 'YouTube',
    emoji: '🔴',
    color: '#dc2626',
    sort_order: 2,
    created_at: DEV_NOW,
  },
  {
    id: 'darts',
    name: 'Dart',
    emoji: '🎯',
    color: '#7c3aed',
    sort_order: 3,
    created_at: DEV_NOW,
  },
];

const categoryMap = Object.fromEntries(
  categories.map((category) => [category.id, category]),
) as Record<string, Category>;

const fakeBets: Bet[] = [
  {
    id: 'dev-bet-1',
    title: 'MŚ 2026: Holandia - Szwecja - obie strzelą',
    category_id: 'football',
    bet_type: '12',
    options: [
      { name: 'NED-SWE BTTS Tak', odds: 1.82 },
      { name: 'NED-SWE BTTS Nie', odds: 1.98 },
    ],
    ends_at: '2026-06-20T19:00:00.000Z',
    is_live: false,
    is_bsplicboost: false,
    is_active: true,
    winning_option: null,
    bet_count: 1,
    created_at: DEV_NOW,
  },
  {
    id: 'dev-bet-2',
    title: 'MŚ 2026: Niemcy - Wybrzeże Kości Słoniowej - handicap',
    category_id: 'football',
    bet_type: '12',
    options: [
      { name: 'Niemcy -1.5 gola', odds: 1.94 },
      { name: 'WKS +1.5 gola', odds: 1.84 },
    ],
    ends_at: '2026-06-20T20:00:00.000Z',
    is_live: false,
    is_bsplicboost: false,
    is_active: true,
    winning_option: null,
    bet_count: 2,
    created_at: DEV_NOW,
  },
  {
    id: 'dev-bet-3',
    title: 'Akcje Ekipy przekroczą 2 zł na giełdzie w 2026 r',
    category_id: 'youtube',
    bet_type: 'single',
    options: [{ name: 'TAK', odds: 2.55 }],
    ends_at: '2026-12-31T22:59:00.000Z',
    is_live: false,
    is_bsplicboost: false,
    is_active: true,
    winning_option: null,
    bet_count: 0,
    created_at: DEV_NOW,
  },
  {
    id: 'dev-bet-4',
    title: 'Krzysztof Ratajski wygra turniej telewizyjny w 2026 r',
    category_id: 'darts',
    bet_type: 'single',
    options: [{ name: 'TAK', odds: 3.15 }],
    ends_at: '2026-12-31T22:59:00.000Z',
    is_live: false,
    is_bsplicboost: false,
    is_active: true,
    winning_option: null,
    bet_count: 3,
    created_at: DEV_NOW,
  },
];

function makeParticipant(
  userId: string,
  username: string,
  ticketNumbers: number[],
): DailyJackpotParticipant {
  return {
    userId,
    username,
    avatarUrl: null,
    ticketNumbers,
    ticketCount: ticketNumbers.length,
  };
}

function buildOtherParticipants(
  currentUserHasTicket: boolean,
): DailyJackpotParticipant[] {
  const sharedParticipants = [
    makeParticipant('dev-user-2', 'Mati', [1, 3]),
    makeParticipant('dev-user-3', 'Ania', [2]),
    makeParticipant('dev-user-4', 'Bartek', [5, 8, 12]),
    makeParticipant('dev-user-5', 'Ola', [9]),
    makeParticipant('dev-user-6', 'Gracz QA 5', [4, 6]),
    makeParticipant('dev-user-7', 'Gracz QA 6', [7]),
    makeParticipant('dev-user-8', 'Gracz QA 7', [10, 11]),
    makeParticipant('dev-user-9', 'Gracz QA 8', [13]),
    makeParticipant('dev-user-10', 'Gracz QA 9', [15, 16]),
    makeParticipant('dev-user-11', 'Gracz QA 10', [17]),
    makeParticipant('dev-user-12', 'Gracz QA 11', [18, 19]),
    makeParticipant('dev-user-13', 'Gracz QA 12', [20]),
    makeParticipant('dev-user-14', 'Gracz QA 13', [21, 23]),
    makeParticipant('dev-user-15', 'Gracz QA 14', [24]),
    makeParticipant('dev-user-16', 'Gracz QA 15', [25, 26]),
  ];

  if (currentUserHasTicket) {
    return [
      ...sharedParticipants,
      makeParticipant('dev-user-17', 'Gracz QA 16', [27, 28, 29]),
      makeParticipant('dev-user-18', 'Gracz QA 17', [30, 31, 32, 33]),
    ];
  }

  return [
    ...sharedParticipants,
    makeParticipant('dev-user-17', 'Gracz QA 16', [27, 28, 29]),
    makeParticipant('dev-user-18', 'Gracz QA 17', [30, 31]),
    makeParticipant('dev-user-19', 'Gracz QA 18', [32, 33]),
  ];
}

function buildSnapshot(
  status: DailyJackpotStatus,
  currentUserTicketCount: number,
): DailyJackpotSnapshot {
  const userWinsDraw = status === 'drawn' && currentUserTicketCount > 0;
  const otherUserWinsDraw = status === 'drawn' && currentUserTicketCount === 0;
  const userTickets = [14, 22].slice(0, currentUserTicketCount);

  return {
    poolId: DEV_POOL_ID,
    poolDate: '2026-06-20',
    status,
    prizeAmount: 2480.75,
    ticketPrice: 100,
    maxTicketsPerPlayer: 2,
    minUniqueUsers: 3,
    participantCount: 18,
    ticketCount: 31 + currentUserTicketCount,
    drawScheduledAt: DEV_DRAW_AT,
    currentUserHasTicket: currentUserTicketCount > 0,
    currentUserTicketCount,
    currentUserTicketNumber: userTickets[0] ?? null,
    currentUserTicketNumbers: userTickets,
    winnerUserId: userWinsDraw
      ? DEV_USER_ID
      : otherUserWinsDraw
        ? 'dev-user-2'
        : null,
    winnerUsername: userWinsDraw
      ? 'codex_e2e'
      : otherUserWinsDraw
        ? 'Mati'
        : null,
    winnerAvatarUrl: null,
    winningTicketNumber: userWinsDraw ? 14 : otherUserWinsDraw ? 1 : null,
    maintenanceAutoCreditedCount: 0,
    serverNow: DEV_NOW,
  };
}

function buildDraw({
  currentUserTicketCount,
  resultViewedAt,
  rewardCreditStatus,
}: {
  currentUserTicketCount: number;
  resultViewedAt: string | null;
  rewardCreditStatus: DailyJackpotRewardCreditStatus;
}): DailyJackpotDraw {
  const userTickets = [14, 22].slice(0, currentUserTicketCount);
  const userWinsDraw = currentUserTicketCount > 0;
  const otherParticipants = buildOtherParticipants(userWinsDraw);
  const currentUserParticipant =
    userTickets.length > 0
      ? [
          makeParticipant(DEV_USER_ID, 'codex_e2e', userTickets),
        ]
      : [];
  const participants = [...currentUserParticipant, ...otherParticipants];

  return {
    poolId: DEV_POOL_ID,
    poolDate: '2026-06-20',
    status: 'drawn',
    prizeAmount: 2480.75,
    ticketPrice: 100,
    minUniqueUsers: 3,
    participantCount: 18,
    ticketCount: 31 + currentUserTicketCount,
    drawScheduledAt: DEV_DRAW_AT,
    drawnAt: '2026-06-20T18:01:12.000Z',
    winnerUserId: userWinsDraw ? DEV_USER_ID : 'dev-user-2',
    winnerUsername: userWinsDraw ? 'codex_e2e' : 'Mati',
    winnerAvatarUrl: null,
    winningTicketNumber: userWinsDraw ? 14 : 1,
    currentUserHasTicket: currentUserTicketCount > 0,
    currentUserTicketCount: userTickets.length,
    currentUserIsWinner: userWinsDraw,
    resultViewedAt,
    rewardClaimedAt:
      rewardCreditStatus === 'claimed' ? '2026-06-20T18:03:40.000Z' : null,
    rewardAutoCreditedAt: null,
    rewardCreditStatus,
    rewardCreditEventId:
      rewardCreditStatus === 'claimed' ? 'dev-credit-event' : null,
    participants,
    serverNow: '2026-06-20T18:04:00.000Z',
  };
}

export default function JackpotDevFlowPage() {
  const [screen, setScreen] = useState<DevScreen>('home');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<'newest' | 'popular' | 'ending_soon'>(
    'newest',
  );
  const [activeOnly, setActiveOnly] = useState(true);
  const [status, setStatus] = useState<DailyJackpotStatus>('collecting');
  const [ticketCount, setTicketCount] = useState(0);
  const [resultViewedAt, setResultViewedAt] = useState<string | null>(null);
  const [rewardCreditStatus, setRewardCreditStatus] =
    useState<DailyJackpotRewardCreditStatus>('pending');

  const snapshot = useMemo(
    () => buildSnapshot(status, ticketCount),
    [status, ticketCount],
  );
  const draw = useMemo(
    () =>
      buildDraw({
        currentUserTicketCount: ticketCount,
        resultViewedAt,
        rewardCreditStatus,
      }),
    [resultViewedAt, rewardCreditStatus, ticketCount],
  );

  const buyTicket = useCallback(() => {
    if (status !== 'collecting') {
      return;
    }

    setTicketCount((current) => Math.min(current + 1, 2));
  }, [status]);

  const openDraw = useCallback(() => {
    setStatus('drawn');
    setScreen('draw');
  }, []);

  const loadDraw = useCallback(async () => draw, [draw]);

  const revealDraw = useCallback(async () => {
    const viewedAt = '2026-06-20T18:02:30.000Z';
    setResultViewedAt(viewedAt);
    return buildDraw({
      currentUserTicketCount: ticketCount,
      resultViewedAt: viewedAt,
      rewardCreditStatus,
    });
  }, [rewardCreditStatus, ticketCount]);

  const claimDrawReward = useCallback(async (): Promise<DailyJackpotClaimResult> => {
    const claimedAt = '2026-06-20T18:03:40.000Z';
    setRewardCreditStatus('claimed');
    return {
      poolId: DEV_POOL_ID,
      amount: 2480.75,
      balanceAfter: 7480.75,
      rewardCreditStatus: 'claimed',
      rewardClaimedAt: claimedAt,
      rewardAutoCreditedAt: null,
      alreadyCredited: false,
    };
  }, []);

  const resetFlow = () => {
    setScreen('home');
    setStatus('collecting');
    setTicketCount(0);
    setResultViewedAt(null);
    setRewardCreditStatus('pending');
  };

  const filteredBets = useMemo(() => {
    const scoped = selectedCategory
      ? fakeBets.filter((bet) => bet.category_id === selectedCategory)
      : fakeBets;
    return activeOnly ? scoped.filter((bet) => bet.is_active) : scoped;
  }, [activeOnly, selectedCategory]);

  return (
    <div className="h-safe-screen bg-background overflow-hidden flex flex-col">
      {screen === 'home' && <Navbar />}

      {screen === 'home' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full max-w-[1600px] mx-auto px-3 pb-0 pt-0 lg:py-3 flex flex-col gap-3">
            <div className="flex-1 min-h-0 flex lg:gap-3">
              <CategorySidebar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                categories={categories}
                loading={false}
              />

              <main className="flex-1 min-w-0 min-h-0 flex flex-col">
                <BetListView
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                  categories={categories}
                  categoryMap={categoryMap}
                  onProposeClick={() => undefined}
                  bets={{
                    loading: false,
                    loadingMore: false,
                    hasMore: false,
                    loadMore: () => undefined,
                    liveBets: [],
                    sortedBets: filteredBets,
                  }}
                  topBanner={
                    <DailyJackpotCard
                      snapshot={snapshot}
                      loading={false}
                      buying={false}
                      balance={5000}
                      onBuy={buyTicket}
                      onOpenDraw={openDraw}
                    />
                  }
                  sort={sort}
                  onSortChange={setSort}
                  activeOnly={activeOnly}
                  onActiveOnlyChange={setActiveOnly}
                />
              </main>

              <CouponDrawer categoryMap={categoryMap} />
            </div>
          </div>
        </div>
      ) : (
        <JackpotDrawExperience
          roundId={DEV_POOL_ID}
          currentUserId={DEV_USER_ID}
          initialDraw={draw}
          loadDraw={loadDraw}
          revealDraw={revealDraw}
          claimDrawReward={claimDrawReward}
          onBack={() => setScreen('home')}
        />
      )}

      <div className="fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/95 px-2 py-2 shadow-xl backdrop-blur">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 rounded-full px-3 text-xs font-bold"
          onClick={resetFlow}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          className={cn(
            'h-8 rounded-full px-3 text-xs font-bold',
            status === 'drawn' && 'opacity-70',
          )}
          disabled={status === 'drawn'}
          onClick={() => setStatus('drawn')}
        >
          <SkipForward className="h-3.5 w-3.5" />
          Symuluj godzinę 20:00
        </Button>
      </div>
    </div>
  );
}
