import type { SocialFeedItem } from '@/types/database';

export function makeCouponFeedItem(
  overrides: Partial<SocialFeedItem> = {},
): SocialFeedItem {
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

export function makePostFeedItem(
  overrides: Partial<SocialFeedItem> = {},
): SocialFeedItem {
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

export function makeCasinoFeedItem(
  overrides: Partial<SocialFeedItem> = {},
): SocialFeedItem {
  return {
    id: 'casino-1',
    item_type: 'casino',
    user_id: 'user-1',
    username: 'Ty',
    avatar_url: null,
    content: 'Wygrana w ruletce: 40.00 zł. Numer 7.',
    total_odds: null,
    stake: 20,
    payout: 40,
    status: 'won',
    legs: null,
    created_at: '2030-01-01T12:00:00.000Z',
    reactions: null,
    comment_count: 0,
    my_reaction: null,
    casino_bet_type: 'color',
    casino_bet_value: 'red',
    casino_stake: 20,
    casino_payout: 40,
    casino_round_number: 123,
    casino_winning_number: 7,
    casino_winning_color: 'red',
    ...overrides,
  };
}

export function makePostPage(size: number, start = 0): SocialFeedItem[] {
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
