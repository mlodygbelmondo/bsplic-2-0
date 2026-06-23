import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { makePostFeedItem } from '@/features/social/test-utils/socialFeedFactories';
import { SocialFeedCard } from './SocialFeedCard';

const searchMentionUsersMock = vi.fn();

vi.mock('@/features/social/api/mentions', () => ({
  searchMentionUsers: (...args: unknown[]) => searchMentionUsersMock(...args),
}));

vi.mock('@/features/social/images', () => ({
  compressImageFile: vi.fn(),
  getSocialImageUrl: (path: string) => `https://example.com/${path}`,
}));

function renderCard(overrides = {}) {
  const props = {
    item: makePostFeedItem({
      id: 'post-1',
      item_type: 'post' as const,
      username: 'Poster',
      content: 'Treść jak w feedzie',
      reactions: { like: 7, heart: 2 },
      comment_count: 3,
    }),
    expandedCoupons: new Set<string>(),
    copyingCoupons: new Set<string>(),
    comments: [],
    commentsLoaded: false,
    commentsLoading: false,
    isLoggedIn: true,
    onToggleCoupon: vi.fn(),
    onCopyCoupon: vi.fn(),
    onToggleReaction: vi.fn(),
    onFirstExpandComments: vi.fn(),
    onAddComment: vi.fn().mockResolvedValue(undefined),
    onToggleCommentReaction: vi.fn(),
    isAko: false,
    currentUserId: 'user-1',
    onOpenItem: vi.fn(),
    onOpenItemReactors: vi.fn(),
    onOpenCommentReactors: vi.fn(),
    ...overrides,
  };

  return {
    ...render(
      <MemoryRouter>
        <SocialFeedCard {...props} />
      </MemoryRouter>,
    ),
    props,
  };
}

describe('SocialFeedCard', () => {
  it('uses Facebook-style mobile engagement instead of the full reaction picker', () => {
    const { container } = renderCard();

    const actionRow = screen.getByTestId('social-mobile-action-row');
    expect(actionRow).toHaveClass('sm:hidden');
    expect(within(actionRow).getByRole('button', { name: 'Lubię to' })).toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: 'Komentarz' })).toBeInTheDocument();
    expect(within(actionRow).getByRole('button', { name: 'Udostępnij' })).toBeInTheDocument();
    expect(within(actionRow.parentElement!).getByText('9')).toBeInTheDocument();
    expect(within(actionRow.parentElement!).getByText('3 komentarze')).toBeInTheDocument();

    expect(container.querySelector('.social-desktop-reaction-bar')).toHaveClass(
      'hidden',
      'sm:block',
    );
  });

  it('toggles the comment input from the engagement comment action', () => {
    const { props } = renderCard();

    fireEvent.click(
      within(screen.getByTestId('social-mobile-action-row')).getByRole(
        'button',
        { name: 'Komentarz' },
      ),
    );

    expect(props.onFirstExpandComments).toHaveBeenCalledWith('post-1', 'post');
    expect(screen.getByLabelText('Napisz komentarz...')).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByTestId('social-mobile-action-row')).getByRole(
        'button',
        { name: 'Komentarz' },
      ),
    );

    expect(screen.queryByLabelText('Napisz komentarz...')).not.toBeInTheDocument();
  });

  it('toggles a like from the mobile Like action', () => {
    const { props } = renderCard();

    fireEvent.click(
      within(screen.getByTestId('social-mobile-action-row')).getByRole(
        'button',
        { name: 'Lubię to' },
      ),
    );

    expect(props.onToggleReaction).toHaveBeenCalledWith('post-1', 'post', 'like');
  });

  it('locally hides a card from the mobile close action', () => {
    renderCard();

    fireEvent.click(screen.getByRole('button', { name: 'Ukryj wpis' }));

    expect(screen.queryByTestId('social-feed-card')).not.toBeInTheDocument();
  });
});
