import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SocialPage from './SocialPage';
import type { SocialFeedItem } from '@/types/database';
import {
  makeCasinoFeedItem,
  makeCouponFeedItem,
  makePostFeedItem,
  makePostPage,
} from '@/features/social/test-utils/socialFeedFactories';

// ── Mocks ────────────────────────────────────────────────────

const fetchSocialFeedMock = vi.fn<() => Promise<SocialFeedItem[]>>();
const fetchSocialFeedItemMock = vi.fn<() => Promise<SocialFeedItem | null>>();
const createPostMock = vi.fn<() => Promise<string>>();
const fetchCommentsMock = vi.fn();
const addCommentMock = vi.fn();
const toggleReactionMock = vi.fn();
const respondAsEniuMock = vi.fn();
const fetchReactorsMock = vi.fn();
const fetchBetsByIdsMock = vi.fn();
const addItemsMock = vi.fn();
const setPreferredCouponTypeMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const navigateMock = vi.fn();
const navbarMock = vi.hoisted(() => vi.fn(() => <div>Navbar</div>));
const realtimeHandlers: Array<{
  table: string;
  callback: (payload: {
    eventType: string;
    new: Record<string, unknown>;
    old: Record<string, unknown>;
  }) => void;
}> = [];
const removeChannelMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(
          (
            _event: string,
            config: { table: string },
            callback: (payload: {
              eventType: string;
              new: Record<string, unknown>;
              old: Record<string, unknown>;
            }) => void,
          ) => {
            realtimeHandlers.push({ table: config.table, callback });
            return channel;
          },
        ),
        subscribe: vi.fn(() => channel),
      };
      return channel;
    }),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
  },
}));

vi.mock('@/components/Navbar', () => ({
  Navbar: (props: { mobileBottomNavHidden?: boolean }) => navbarMock(props),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    profile: {
      id: 'user-1',
      username: 'Tester',
      avatar_url: 'https://cdn.example/tester.jpg',
    },
    isAdmin: false,
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('@/features/social/api/social', () => ({
  fetchSocialFeed: (...args: unknown[]) => fetchSocialFeedMock(...(args as [])),
  fetchSocialFeedItem: (...args: unknown[]) =>
    fetchSocialFeedItemMock(...(args as [])),
  createPost: (...args: unknown[]) => createPostMock(...(args as [])),
  fetchComments: (...args: unknown[]) => fetchCommentsMock(...args),
  addComment: (...args: unknown[]) => addCommentMock(...args),
  toggleReaction: (...args: unknown[]) => toggleReactionMock(...args),
}));

vi.mock('@/features/social/api/eniuBot', () => ({
  respondAsEniu: (...args: unknown[]) => respondAsEniuMock(...args),
}));

vi.mock('@/features/social/api/reactions', () => ({
  fetchReactors: (...args: unknown[]) => fetchReactorsMock(...args),
}));

vi.mock('@/features/social/api/mentions', () => ({
  searchMentionUsers: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/social/images', () => ({
  compressImageFile: vi.fn(),
  getSocialImageUrl: (path: string) => `https://cdn.example/${path}`,
  uploadSocialImage: vi.fn(),
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
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ── Helpers ──────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────

describe('SocialPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navbarMock.mockClear();
    realtimeHandlers.length = 0;
    fetchSocialFeedMock.mockResolvedValue([makeCouponFeedItem()]);
    fetchSocialFeedItemMock.mockResolvedValue(null);
    fetchCommentsMock.mockResolvedValue([]);
    createPostMock.mockResolvedValue('new-post-id');
    addCommentMock.mockResolvedValue('new-comment-id');
    toggleReactionMock.mockResolvedValue('like');
    respondAsEniuMock.mockResolvedValue({ ok: true });
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

  it('renders loader then feed items', async () => {
    renderSocialPage();
    // While loading, the branded loader is shown; after the feed resolves
    // the item should appear.
    expect(await screen.findByText('Typster')).toBeInTheDocument();
  });

  it('hides mobile bottom nav on deliberate downward feed scroll', async () => {
    const { container } = renderSocialPage();

    expect(await screen.findByText('Typster')).toBeInTheDocument();
    expect(navbarMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mobileBottomNavHidden: false }),
    );

    const scrollContainer = container.querySelector(
      "[data-testid='social-scroll-container']",
    ) as HTMLDivElement;
    Object.defineProperties(scrollContainer, {
      scrollTop: { configurable: true, value: 90 },
      scrollHeight: { configurable: true, value: 1800 },
      clientHeight: { configurable: true, value: 700 },
    });
    fireEvent.scroll(scrollContainer);

    expect(navbarMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ mobileBottomNavHidden: true }),
    );
    expect(scrollContainer).toHaveClass(
      'pb-[var(--mobile-bottom-nav-scroll-padding)]',
    );
  });

  it('uses an edge-to-edge mobile feed shell while restoring desktop spacing from sm up', async () => {
    fetchSocialFeedMock.mockResolvedValue([makePostFeedItem()]);
    const { container } = renderSocialPage();

    expect(await screen.findByText('Cześć, to mój pierwszy post!')).toBeInTheDocument();

    const feedContent = container.querySelector(
      "[data-testid='social-feed-content']",
    );
    expect(feedContent).toHaveClass(
      'w-full',
      'max-w-3xl',
      'mx-auto',
      'px-0',
      'pt-2',
      'sm:px-4',
      'sm:py-4',
    );

    expect(screen.getByRole('heading', { name: 'Social' })).toHaveClass(
      'sr-only',
      'sm:not-sr-only',
    );

    expect(container.querySelector("[data-testid='social-filter-bar']")).toHaveClass(
      'sticky',
      'top-0',
      'z-20',
      'rounded-none',
      'sm:rounded-lg',
    );
  });

  it('shows empty state when feed is empty', async () => {
    fetchSocialFeedMock.mockResolvedValue([]);
    renderSocialPage();
    expect(await screen.findByText('Brak aktywności')).toBeInTheDocument();
  });

  it('displays a post feed item', async () => {
    fetchSocialFeedMock.mockResolvedValue([makePostFeedItem()]);
    renderSocialPage();
    const postContent = await screen.findByText('Cześć, to mój pierwszy post!');
    expect(postContent).toBeInTheDocument();
    expect(postContent.closest('.app-surface')).not.toBeNull();
    expect(postContent.closest("[data-testid='social-feed-card']")).toHaveClass(
      'social-edge-surface',
      'rounded-none',
      'sm:rounded-xl',
    );
    expect(screen.getByText('Poster')).toBeInTheDocument();
    // No copy-coupon button for posts
    expect(
      screen.queryByRole('button', { name: /skopiuj kupon/i }),
    ).not.toBeInTheDocument();
  });

  it('opens a dedicated social item page when clicking a post card', async () => {
    fetchSocialFeedMock.mockResolvedValue([makePostFeedItem()]);
    renderSocialPage();

    fireEvent.click(await screen.findByText('Cześć, to mój pierwszy post!'));

    expect(navigateMock).toHaveBeenCalledWith('/social/post/post-1');
  });

  it('displays both posts and coupons in mixed feed', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem(),
      makePostFeedItem(),
    ]);
    renderSocialPage();
    expect(await screen.findByText('Typster')).toBeInTheDocument();
    expect(screen.getByText('Poster')).toBeInTheDocument();
    expect(
      screen.getByText('Cześć, to mój pierwszy post!'),
    ).toBeInTheDocument();
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
    expect(fetchSocialFeedItemMock).toHaveBeenCalledWith(
      'post',
      'post-notif',
      'user-1',
    );
  });

  it('keeps target feed item visible when the first feed page resolves after notification preload', async () => {
    let resolveFeed: (items: SocialFeedItem[]) => void = () => undefined;
    const feedPromise = new Promise<SocialFeedItem[]>((resolve) => {
      resolveFeed = resolve;
    });
    fetchSocialFeedMock.mockReturnValueOnce(feedPromise);
    fetchSocialFeedItemMock.mockResolvedValueOnce(
      makePostFeedItem({
        id: 'post-race',
        content: 'Wpis z opóźnionego powiadomienia',
        username: 'RaceUser',
      }),
    );

    renderSocialPageWithRoute('/social?itemType=post&itemId=post-race');

    await waitFor(() => {
      expect(fetchSocialFeedItemMock).toHaveBeenCalledWith(
        'post',
        'post-race',
        'user-1',
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      resolveFeed([]);
      await feedPromise;
    });

    expect(
      await screen.findByText('Wpis z opóźnionego powiadomienia'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Brak aktywności')).not.toBeInTheDocument();
  });

  it('refreshes the changed feed item when a realtime social post event arrives', async () => {
    fetchSocialFeedMock.mockResolvedValueOnce([
      makePostFeedItem({
        id: 'post-live',
        content: 'Stara treść',
      }),
    ]);
    fetchSocialFeedItemMock.mockResolvedValueOnce(
      makePostFeedItem({
        id: 'post-live',
        content: 'Nowa treść z realtime',
      }),
    );

    renderSocialPage();

    expect(await screen.findByText('Stara treść')).toBeInTheDocument();

    const postHandler = realtimeHandlers.find(
      (handler) => handler.table === 'social_realtime_events',
    );
    expect(postHandler).toBeDefined();

    await act(async () => {
      postHandler?.callback({
        eventType: 'INSERT',
        new: {
          target_type: 'post',
          target_id: 'post-live',
          source_table: 'social_posts',
          operation: 'UPDATE',
        },
        old: {},
      });
    });

    await waitFor(() => {
      expect(fetchSocialFeedItemMock).toHaveBeenCalledWith(
        'post',
        'post-live',
        'user-1',
      );
    });
    expect(await screen.findByText('Nowa treść z realtime')).toBeInTheDocument();
  });

  it('refreshes loaded coupon feed items from realtime coupon events', async () => {
    fetchSocialFeedMock.mockResolvedValueOnce([
      makeCouponFeedItem({
        id: 'coupon-live',
        status: 'pending',
        payout: 0,
      }),
    ]);
    fetchSocialFeedItemMock.mockResolvedValueOnce(
      makeCouponFeedItem({
        id: 'coupon-live',
        status: 'won',
        payout: 21,
      }),
    );

    renderSocialPage();

    expect(await screen.findByText('Typster')).toBeInTheDocument();

    const socialEventHandler = realtimeHandlers.find(
      (handler) => handler.table === 'social_realtime_events',
    );

    await act(async () => {
      socialEventHandler?.callback({
        eventType: 'INSERT',
        new: {
          target_type: 'coupon',
          target_id: 'coupon-live',
          source_table: 'coupons',
          operation: 'UPDATE',
        },
        old: {},
      });
    });

    await waitFor(() => {
      expect(fetchSocialFeedItemMock).toHaveBeenCalledWith(
        'coupon',
        'coupon-live',
        'user-1',
      );
    });
  });

  it('filters feed to show only coupons', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem({ id: 'coupon-1', username: 'Kuponiarz' }),
      makePostFeedItem({
        id: 'post-1',
        username: 'Poster',
        content: 'Treść posta',
      }),
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
      makePostFeedItem({
        id: 'post-1',
        username: 'Poster',
        content: 'Treść posta',
      }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Kuponiarz')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Posty' }));

    expect(screen.getByText('Treść posta')).toBeInTheDocument();
    expect(screen.queryByText('Kuponiarz')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /skopiuj kupon/i }),
    ).not.toBeInTheDocument();
  });

  it('returns to mixed feed when selecting all filter', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCouponFeedItem({ id: 'coupon-1', username: 'Kuponiarz' }),
      makePostFeedItem({
        id: 'post-1',
        username: 'Poster',
        content: 'Treść posta',
      }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Kuponiarz')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Posty' }));
    expect(screen.queryByText('Kuponiarz')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wszystko' }));
    expect(screen.getByText('Kuponiarz')).toBeInTheDocument();
    expect(screen.getByText('Treść posta')).toBeInTheDocument();
  });

  it('explains when the selected social filter has no matching activity', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makePostFeedItem({
        id: 'post-1',
        username: 'Poster',
        content: 'Treść posta',
      }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Treść posta')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Kupony' }));

    expect(screen.getByText('Brak kuponów w tej chwili')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż wszystko' }));

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

    const openReactorsButton = await screen.findByRole('button', {
      name: 'Wyświetl reakcje',
    });
    fireEvent.click(openReactorsButton);

    await waitFor(() => {
      expect(fetchReactorsMock).toHaveBeenCalledWith({
        postId: 'post-reactors',
      });
    });
  });

  it('renders avatar image in feed card when avatar_url exists', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makePostFeedItem({
        id: 'post-avatar',
        username: 'AvatarUser',
        avatar_url: 'https://cdn.example/avatar.jpg',
      }),
    ]);

    renderSocialPage();

    const avatar = await screen.findByAltText('Avatar AvatarUser');
    expect(avatar).toHaveAttribute('src', 'https://cdn.example/avatar.jpg');
  });

  it('renders casino win shares with the real username and coupon-like layout', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCasinoFeedItem({
        username: 'Tester',
        avatar_url: 'https://cdn.example/tester.jpg',
      }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Tester')).toBeInTheDocument();
    expect(screen.queryByText('Ty')).not.toBeInTheDocument();
    expect(screen.getByAltText('Avatar Tester')).toHaveAttribute(
      'src',
      'https://cdn.example/tester.jpg',
    );
    expect(screen.getByText('Ruletka')).toBeInTheDocument();
    expect(screen.getByText('Kolor: Czerwone')).toBeInTheDocument();
    expect(screen.getByText('+40.00 zł')).toBeInTheDocument();
    expect(screen.getByText('Runda #123')).toBeInTheDocument();
  });

  it('shows a missing-result fallback instead of question marks for old casino shares', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCasinoFeedItem({
        casino_bet_type: 'straight',
        casino_bet_value: '0',
        casino_winning_number: null,
        casino_winning_color: null,
      }),
    ]);

    renderSocialPage();

    expect(await screen.findByText('Numer: 0')).toBeInTheDocument();
    expect(
      screen.getByText('Wynik niedostępny • Stawka 20.00 zł'),
    ).toBeInTheDocument();
    expect(screen.queryByText('?')).not.toBeInTheDocument();
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
      constructor(
        cb: IntersectionObserverCallback,
        options?: IntersectionObserverInit,
      ) {
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
        observerCallback?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      });

      await waitFor(() => {
        expect(fetchSocialFeedMock).toHaveBeenNthCalledWith(
          2,
          50,
          50,
          'user-1',
        );
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
    expect(
      await screen.findByPlaceholderText('Co nowego?'),
    ).toBeInTheDocument();
  });

  it('triggers Eniu after publishing a post that mentions him', async () => {
    renderSocialPage();

    fireEvent.change(await screen.findByPlaceholderText('Co nowego?'), {
      target: { value: '@Eniu powiedz coś o kuponach' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Opublikuj post' }));

    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalledWith(
        'user-1',
        '@Eniu powiedz coś o kuponach',
      );
      expect(respondAsEniuMock).toHaveBeenCalledWith('post', 'new-post-id');
    });
  });

  it('logs but does not toast when Eniu fails after publishing a mentioned post', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    respondAsEniuMock.mockResolvedValueOnce({
      ok: false,
      error: 'Eniu did not respond',
    });

    try {
      renderSocialPage();

      fireEvent.change(await screen.findByPlaceholderText('Co nowego?'), {
        target: { value: '@Eniu powiedz coś o kuponach' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Opublikuj post' }));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Eniu failed to respond',
          'Eniu did not respond',
        );
      });
      expect(toastErrorMock).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('does not trigger Eniu after publishing a post without a mention', async () => {
    renderSocialPage();

    fireEvent.change(await screen.findByPlaceholderText('Co nowego?'), {
      target: { value: 'Bez wołania bota' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Opublikuj post' }));

    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalled();
    });
    expect(respondAsEniuMock).not.toHaveBeenCalled();
  });

  it('triggers Eniu silently after adding a comment that mentions him', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makePostFeedItem({ id: 'post-eniu' }),
    ]);
    renderSocialPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Pokaż komentarze (0)' }),
    );
    fireEvent.change(screen.getByLabelText('Napisz komentarz...'), {
      target: { value: '@eniu dawaj opinię' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Wyślij komentarz' }));

    await waitFor(() => {
      expect(addCommentMock).toHaveBeenCalled();
      expect(respondAsEniuMock).toHaveBeenCalledWith(
        'comment',
        'new-comment-id',
      );
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  // ── Coupon copy ──────────────────────────────────────────

  describe('coupon copy', () => {
    it('copies coupon and redirects user to home page', async () => {
      renderSocialPage();

      const copyButton = await screen.findByRole('button', {
        name: /skopiuj kupon/i,
      });
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

      const copyButton = await screen.findByRole('button', {
        name: /skopiuj kupon/i,
      });
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
      const copyButton = await screen.findByRole('button', {
        name: /skopiuj kupon/i,
      });
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

  it('toggles casino reaction through the server feed target', async () => {
    fetchSocialFeedMock.mockResolvedValue([
      makeCasinoFeedItem({
        id: 'casino-reaction',
        reactions: { fire: 2 },
      }),
    ]);
    toggleReactionMock.mockResolvedValue('fire');

    renderSocialPage();

    const reactionButton = await screen.findByLabelText('🔥 2');
    fireEvent.click(reactionButton);

    await waitFor(() => {
      expect(toggleReactionMock).toHaveBeenCalledWith({
        userId: 'user-1',
        emoji: 'fire',
        postId: undefined,
        couponId: undefined,
        casinoShareId: 'casino-reaction',
      });
    });

    expect(fetchSocialFeedMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('🔥 3')).toBeInTheDocument();
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
