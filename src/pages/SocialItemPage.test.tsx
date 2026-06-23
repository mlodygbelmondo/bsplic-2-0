import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SocialItemPage from './SocialItemPage';
import type { SocialComment, SocialFeedItem } from '@/types/database';
import { makePostFeedItem } from '@/features/social/test-utils/socialFeedFactories';

const fetchSocialFeedItemMock = vi.fn<() => Promise<SocialFeedItem | null>>();
const fetchCommentsMock = vi.fn<() => Promise<SocialComment[]>>();
const addCommentMock = vi.fn();
const toggleReactionMock = vi.fn();
const fetchBetsByIdsMock = vi.fn();
const addItemsMock = vi.fn();
const setPreferredCouponTypeMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const uploadSocialImageMock = vi.fn();
const respondAsEniuMock = vi.fn();
const fetchReactorsMock = vi.fn();

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <div>Navbar</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    profile: {
      id: 'user-1',
      username: 'Tester',
      avatar_url: 'https://cdn.example/tester.jpg',
    },
  }),
}));

vi.mock('@/features/social/api/social', () => ({
  fetchSocialFeedItem: (...args: unknown[]) =>
    fetchSocialFeedItemMock(...(args as [])),
  fetchComments: (...args: unknown[]) => fetchCommentsMock(...(args as [])),
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
  uploadSocialImage: (...args: unknown[]) => uploadSocialImageMock(...args),
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

function makeComment(overrides: Partial<SocialComment> = {}): SocialComment {
  return {
    id: 'comment-1',
    user_id: 'user-2',
    username: 'Komentator',
    avatar_url: null,
    content: 'Komentarz widoczny od razu',
    parent_id: null,
    created_at: '2030-01-01T12:00:00.000Z',
    reactions: null,
    my_reaction: null,
    ...overrides,
  };
}

function renderSocialItemPage(route = '/social/post/post-dedicated') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/social/:itemType/:itemId" element={<SocialItemPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SocialItemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSocialFeedItemMock.mockResolvedValue(
      makePostFeedItem({
        id: 'post-dedicated',
        content: 'Dedykowany wpis',
        comment_count: 1,
      }),
    );
    fetchCommentsMock.mockResolvedValue([makeComment()]);
    addCommentMock.mockResolvedValue('new-comment-id');
    toggleReactionMock.mockResolvedValue('like');
    fetchBetsByIdsMock.mockResolvedValue([]);
    respondAsEniuMock.mockResolvedValue({ ok: true });
    fetchReactorsMock.mockResolvedValue([]);
  });

  it('loads a dedicated social item and opens comments immediately', async () => {
    const { container } = renderSocialItemPage();

    expect(await screen.findByText('Dedykowany wpis')).toBeInTheDocument();
    expect(await screen.findByText('Komentarz widoczny od razu')).toBeInTheDocument();
    expect(screen.getByLabelText('Napisz komentarz...')).toBeInTheDocument();
    expect(container.querySelector("[data-testid='social-item-content']")).toHaveClass(
      'social-facebook-feed',
      'w-full',
      'max-w-3xl',
      'mx-auto',
      'px-0',
      'pt-2',
      'sm:px-4',
      'sm:py-4',
    );
    expect(container.querySelector('.social-mobile-page')).toBeInTheDocument();
    expect(container.querySelector("[data-testid='social-feed-card']")).toHaveClass(
      'social-edge-surface',
      'rounded-none',
      'sm:rounded-xl',
    );

    await waitFor(() => {
      expect(fetchSocialFeedItemMock).toHaveBeenCalledWith(
        'post',
        'post-dedicated',
        'user-1',
      );
      expect(fetchCommentsMock).toHaveBeenCalledWith(
        { postId: 'post-dedicated' },
        'user-1',
      );
    });
  });
});
