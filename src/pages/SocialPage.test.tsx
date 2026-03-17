import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SocialPage from './SocialPage';
import type { SocialFeedItem } from '@/types/database';

// ── Mocks ────────────────────────────────────────────────────

const fetchSocialFeedMock = vi.fn<() => Promise<SocialFeedItem[]>>();
const fetchSocialFeedItemMock = vi.fn<() => Promise<SocialFeedItem | null>>();
const createPostMock = vi.fn<() => Promise<string>>();
const fetchCommentsMock = vi.fn();
const addCommentMock = vi.fn();
const toggleReactionMock = vi.fn();
const fetchReactorsMock = vi.fn();
const fetchBetsByIdsMock = vi.fn();
const addItemsMock = vi.fn();
const setPreferredCouponTypeMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    profile: { id: 'user-1', username: 'Tester', avatar_url: null },
    isAdmin: false,
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('@/features/social/api/social', () => ({
  fetchSocialFeed: (...args: unknown[]) => fetchSocialFeedMock(...(args as [])),
  fetchSocialFeedItem: (...args: unknown[]) => fetchSocialFeedItemMock(...(args as [])),
  createPost: (...args: unknown[]) => createPostMock(...(args as [])),
  fetchComments: (...args: unknown[]) => fetchCommentsMock(...args),
  addComment: (...args: unknown[]) => addCommentMock(...args),
  toggleReaction: (...args: unknown[]) => toggleReactionMock(...args),
}));

vi.mock('@/features/social/api/reactions', () => ({
  fetchReactors: (...args: unknown[]) => fetchReactorsMock(...args),
}));

vi.mock('@/features/home/api/bets', () => ({
  fetchBetsByIds: (...args: unknown[]) => fetchBetsByIdsMock(...args),
}));

vi.mock('@/contexts/CouponContext', () => ({
  useCoupon: () => ({
    addItems: addItemsMock,
    setPreferredCouponType: setPreferredCouponTypeMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ── Helpers ──────────────────────────────────────────────────

function makeCouponFeedItem(overrides: Partial<SocialFeedItem> = {}): SocialFeedItem {
  return {
    id: 'coupon-1',
    item_type: 'coupon',
    user_id: 'user-2',
    username: 'Typster',
    avatar_url: null,
    content: null,
    total_odds: 2.1,
    stake: 10,
    payout: 0,
    status: 'pending',
    created_at: '2030-01-01T10:00:00.000Z',
    legs: [
      {
        id: 'leg-1',
        bet_id: 'bet-1',
        selected_option: 'Dom',
        odds_at_time: 2.0,
        result: 'pending',
        bet_title: 'Mecz dnia',
      },
    ],
    reactions: null,
    comment_count: 0,
    my_reaction: null,
    ...overrides,
  };
}

function makePostFeedItem(overrides: Partial<SocialFeedItem> = {}): SocialFeedItem {
  return {
    id: 'post-1',
    item_type: 'post',
    user_id: 'user-3',
    username: 'Poster',
    avatar_url: null,
    content: 'Cześć, to mój pierwszy post!',
    total_odds: null,
    stake: null,
    payout: null,
    status: null,
    legs: null,
    created_at: '2030-01-01T11:00:00.000Z',
    reactions: null,
    comment_count: 0,
    my_reaction: null,
    ...overrides,
  };
}

function renderSocialPage() {
  return render(
    <MemoryRouter>
      <SocialPage />
    </MemoryRouter>,
  );
}

function renderSocialPageWithRoute(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SocialPage />
    </MemoryRouter>,
  );
}

function makePostPage(size: number, start = 0): SocialFeedItem[] {
  return Array.from({ length: size }, (_, index) => {
    const n = start + index;
    return makePostFeedItem({
      id: `post-${n}`,
      username: `Poster ${n}`,
      content: `Post treść ${n}`,
      created_at: `2030-01-01T11:${String(n % 60).padStart(2, '0')}:00.000Z`,
    });
  });
}

// ── Tests ────────────────────────────────────────────────────

describe('SocialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSocialFeedMock.mockResolvedValue([makeCouponFeedItem()]);
    fetchSocialFeedItemMock.mockResolvedValue(null);
    fetchCommentsMock.mockResolvedValue([]);
    createPostMock.mockResolvedValue('new-post-id');
    addCommentMock.mockResolvedValue('new-comment-id');
    toggleReactionMock.mockResolvedValue('like');
    fetchReactorsMock.mockResolvedValue([]);

    fetchBetsByIdsMock.mockResolvedValue([
      {
        id: 'bet-1',
        title: 'Mecz dnia',
        category_id: 'cat-1',
        bet_type: '12',
        options: [
          { name: 'Dom', odds: 2.2 },
          { name: 'Wyjazd', odds: 1.7 },
        ],
        ends_at: '2030-01-01T12:00:00.000Z',
        is_live: false,
        is_active: true,
        winning_option: null,
        bet_count: 0,
        created_at: '2030-01-01T09:00:00.000Z',
      },
    ]);
  });

  // ── Feed rendering ───────────────────────────────────────

  it('renders loading skeletons then feed items', async () => {
    renderSocialPage();
    // While loading, skeletons are shown (they are generic divs, hard to query, but
    // after the feed resolves the item should appear).
    expect(await screen.findByText('Typster')).toBeInTheDocument();
  });

  it('shows empty state when feed is empty', async () => {
    fetchSocialFeedMock.mockResolvedValue([]);
    renderSocialPage();
    expect(await screen.findByText('Brak aktywności')).toBeInTheDocument();
  });

  it('displays a post feed item', async () => {
    fetchSocialFeedMock.mockResolvedValue([makePostFeedItem()]);
    renderSocialPage();
    expect(await screen.findByText('Cześć, to mój pierwszy post!')).toBeInTheDocument();
    expect(screen.getByText('Poster')).toBeInTheDocument();
    // No copy-coupon button for posts
    expect(screen.queryByRole('button', { name: /skopiuj kupon/i })).not.toBeInTheDocument();
  });

  it('displays both posts and coupons in mixed feed', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem(),
      makePostFeedItem(),
    ]);
    renderSocialPage();
    expect(await screen.findByText('Typster')).toBeInTheDocument();
    expect(screen.getByText('Poster')).toBeInTheDocument();
    expect(screen.getByText('Cześć, to mój pierwszy post!')).toBeInTheDocument();
  });

  it('loads target feed item from notification link params when item is not in current page', async () => {
    fetchSocialFeedMock.mockResolvedValueOnce([]);
    fetchSocialFeedItemMock.mockResolvedValueOnce(
      makePostFeedItem({
        id: 'post-notif',
        content: 'Wpis z powiadomienia',
        username: 'Pingowany',
      }),
    );

    renderSocialPageWithRoute('/social?itemType=post&itemId=post-notif');

    expect(await screen.findByText('Wpis z powiadomienia')).toBeInTheDocument();
    expect(fetchSocialFeedItemMock).toHaveBeenCalledWith('post', 'post-notif', 'user-1');
  });

  it('filters feed to show only coupons', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem({ id: 'coupon-1', username: 'Kuponiarz' }),
      makePostFeedItem({ id: 'post-1', username: 'Poster', content: 'Treść posta' }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Kuponiarz')).toBeInTheDocument();
    expect(screen.getByText('Treść posta')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kupony' }));

    expect(screen.getByText('Kuponiarz')).toBeInTheDocument();
    expect(screen.queryByText('Treść posta')).not.toBeInTheDocument();
  });

  it('filters feed to show only posts', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem({ id: 'coupon-1', username: 'Kuponiarz' }),
      makePostFeedItem({ id: 'post-1', username: 'Poster', content: 'Treść posta' }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Kuponiarz')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Posty' }));

    expect(screen.getByText('Treść posta')).toBeInTheDocument();
    expect(screen.queryByText('Kuponiarz')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /skopiuj kupon/i })).not.toBeInTheDocument();
  });

  it('returns to mixed feed when selecting all filter', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem({ id: 'coupon-1', username: 'Kuponiarz' }),
      makePostFeedItem({ id: 'post-1', username: 'Poster', content: 'Treść posta' }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Kuponiarz')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Posty' }));
    expect(screen.queryByText('Kuponiarz')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wszystko' }));
    expect(screen.getByText('Kuponiarz')).toBeInTheDocument();
    expect(screen.getByText('Treść posta')).toBeInTheDocument();
  });

  it('opens reactors dialog when clicking "Wyświetl reakcje"', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makePostFeedItem({
        id: 'post-reactors',
        reactions: { like: 2 },
      }),
    ]);

    renderSocialPage();

    const openReactorsButton = await screen.findByRole('button', { name: 'Wyświetl reakcje' });
    fireEvent.click(openReactorsButton);

    await waitFor(() => {
      expect(fetchReactorsMock).toHaveBeenCalledWith({
        postId: 'post-reactors',
      });
    });
  });

  it('shows initial comment count from feed before loading thread comments', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makePostFeedItem({
        id: 'post-with-comments',
        comment_count: 3,
      }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('3 komentarze')).toBeInTheDocument();
    expect(fetchCommentsMock).not.toHaveBeenCalled();
  });

  it('loads more feed items when sentinel enters viewport', async () => {
    const firstPage = makePostPage(50, 0);
    const secondPage = makePostPage(1, 50);
    fetchSocialFeedMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);

    let observerCallback: IntersectionObserverCallback | null = null;
    let observerOptions: IntersectionObserverInit | undefined;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    class MockIntersectionObserver {
      constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observerCallback = cb;
        observerOptions = options;
      }

      observe = observeMock;

      disconnect = disconnectMock;

      unobserve = vi.fn();

      takeRecords = vi.fn(() => []);

      root = null;

      rootMargin = '';

      thresholds = [];
    }

    const originalIntersectionObserver = globalThis.IntersectionObserver;
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: MockIntersectionObserver,
    });

    try {
      renderSocialPage();

      expect(await screen.findByText('Post treść 0')).toBeInTheDocument();
      expect(fetchSocialFeedMock).toHaveBeenNthCalledWith(1, 50, 0, 'user-1');
      expect(observerOptions?.rootMargin).toBe('1200px 0px');

      await act(async () => {
        observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      });

      await waitFor(() => {
        expect(fetchSocialFeedMock).toHaveBeenNthCalledWith(2, 50, 50, 'user-1');
      });

      expect(await screen.findByText('Post treść 50')).toBeInTheDocument();
      expect(observeMock).toHaveBeenCalled();
      expect(disconnectMock).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'IntersectionObserver', {
        configurable: true,
        writable: true,
        value: originalIntersectionObserver,
      });
    }
  });

  // ── PostComposer ─────────────────────────────────────────

  it('renders PostComposer for logged-in user', async () => {
    renderSocialPage();
    // PostComposer should have a textarea with placeholder
    expect(await screen.findByPlaceholderText('Co nowego?')).toBeInTheDocument();
  });

  // ── Coupon copy ──────────────────────────────────────────

  describe('coupon copy', () => {
    it('copies coupon and redirects user to home page', async () => {
      renderSocialPage();

      const copyButton = await screen.findByRole('button', { name: /skopiuj kupon/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(fetchBetsByIdsMock).toHaveBeenCalledWith(['bet-1']);
        expect(addItemsMock).toHaveBeenCalledTimes(1);
        expect(setPreferredCouponTypeMock).toHaveBeenCalledWith('single');
        expect(navigateMock).toHaveBeenCalledWith('/');
      });
    });

    it('sets preferred coupon type to ako for multi-leg copied coupon', async () => {
      fetchSocialFeedMock.mockResolvedValueOnce([
        makeCouponFeedItem({
          id: 'coupon-ako',
          user_id: 'user-3',
          username: 'Multi',
          total_odds: 4.2,
          stake: 20,
          legs: [
            {
              id: 'leg-1',
              bet_id: 'bet-1',
              selected_option: 'Dom',
              odds_at_time: 2.0,
              result: 'pending',
              bet_title: 'Mecz 1',
            },
            {
              id: 'leg-2',
              bet_id: 'bet-2',
              selected_option: 'Gość',
              odds_at_time: 2.1,
              result: 'pending',
              bet_title: 'Mecz 2',
            },
          ],
        }),
      ]);

      fetchBetsByIdsMock.mockResolvedValueOnce([
        {
          id: 'bet-1',
          title: 'Mecz 1',
          category_id: 'cat-1',
          bet_type: '12',
          options: [
            { name: 'Dom', odds: 2.2 },
            { name: 'Gość', odds: 1.7 },
          ],
          ends_at: '2030-01-01T12:00:00.000Z',
          is_live: false,
          is_active: true,
          winning_option: null,
          bet_count: 0,
          created_at: '2030-01-01T09:00:00.000Z',
        },
        {
          id: 'bet-2',
          title: 'Mecz 2',
          category_id: 'cat-2',
          bet_type: '12',
          options: [
            { name: 'Dom', odds: 1.8 },
            { name: 'Gość', odds: 2.3 },
          ],
          ends_at: '2030-01-01T13:00:00.000Z',
          is_live: false,
          is_active: true,
          winning_option: null,
          bet_count: 0,
          created_at: '2030-01-01T09:05:00.000Z',
        },
      ]);

      renderSocialPage();

      const copyButton = await screen.findByRole('button', { name: /skopiuj kupon/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(setPreferredCouponTypeMock).toHaveBeenCalledWith('ako');
      });
    });

    it('shows error toast when coupon has no copyable legs', async () => {
      fetchSocialFeedMock.mockResolvedValueOnce([
        makeCouponFeedItem({
          legs: [
            {
              id: 'leg-1',
              bet_id: null,
              selected_option: 'Dom',
              odds_at_time: 2.0,
              result: 'pending',
              bet_title: 'Mecz',
            },
          ],
        }),
      ]);

      renderSocialPage();
      const copyButton = await screen.findByRole('button', { name: /skopiuj kupon/i });
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(toastErrorMock).toHaveBeenCalledWith(
          'Ten kupon nie zawiera zdarzeń możliwych do skopiowania',
        );
      });
    });
  });

  // ── Reactions ────────────────────────────────────────────

  it('displays reaction counts when present', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makePostFeedItem({ reactions: { like: 3, heart: 1 } }),
    ]);
    renderSocialPage();

    // ReactionBar should show the count
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('toggles post reaction without reloading whole feed', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makePostFeedItem({
        id: 'post-reaction',
        reactions: { like: 3 },
        my_reaction: 'like',
      }),
    ]);
    toggleReactionMock.mockResolvedValue(null);

    renderSocialPage();

    const reactionButton = await screen.findByLabelText('👍 3');
    fireEvent.click(reactionButton);

    await waitFor(() => {
      expect(toggleReactionMock).toHaveBeenCalledWith({
        userId: 'user-1',
        emoji: 'like',
        postId: 'post-reaction',
        couponId: undefined,
      });
    });

    expect(fetchSocialFeedMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('👍 2')).toBeInTheDocument();
  });

  // ── AKO coupon toggle ────────────────────────────────────

  it('shows AKO badge and toggles expanded legs on click', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem({
        id: 'coupon-ako',
        total_odds: 4.2,
        legs: [
          {
            id: 'leg-1',
            bet_id: 'bet-1',
            selected_option: 'Dom',
            odds_at_time: 2.0,
            result: 'pending',
            bet_title: 'Mecz A',
          },
          {
            id: 'leg-2',
            bet_id: 'bet-2',
            selected_option: 'Gość',
            odds_at_time: 2.1,
            result: 'pending',
            bet_title: 'Mecz B',
          },
        ],
      }),
    ]);

    renderSocialPage();
    // AKO badge
    expect(await screen.findByText('AKO 2')).toBeInTheDocument();

    // Legs not visible initially
    expect(screen.queryByText('Mecz A')).not.toBeInTheDocument();

    // Click to expand
    const akoButton = screen.getByText('AKO 2').closest('button')!;
    fireEvent.click(akoButton);

    expect(await screen.findByText('Mecz A')).toBeInTheDocument();
    expect(screen.getByText('Mecz B')).toBeInTheDocument();
  });
});
