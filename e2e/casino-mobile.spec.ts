import { test, expect, type Page, type Locator } from "@playwright/test";
const USER = "11111111-1111-4111-8111-111111111111";
async function setup(page: Page, mode: 'betting' | 'playing' | 'insurance' | 'split' = 'betting') {
  const state = { requests: [] as { rpc: string; body: Record<string, unknown> }[], errors: [] as string[] };
  const cards = [{ id: 'p1', suit: 'hearts', rank: '8', value: 8 }, { id: 'p2', suit: 'spades', rank: '8', value: 8 }];
  const game = {
    id: '22222222-2222-4222-8222-222222222222', stake: 10, initial_stake: 10,
    status: mode === 'insurance' ? 'insurance' : 'playing',
    player_hand: cards,
    player_hands: [{ id: 'hand-1', cards, stake: 10, payout: 0, status: 'playing', double_down_used: false, is_split_aces: false }],
    active_hand_index: 0,
    dealer_hand: [{ id: 'd1', suit: 'clubs', rank: mode === 'insurance' ? 'A' : '10', value: mode === 'insurance' ? 11 : 10 }],
    payout: 0, double_down_used: false, deck_count: 2, cards_remaining: 100,
    shoe_number: 1, dealer_hidden_count: 1, insurance_status: mode === 'insurance' ? 'offered' : 'unavailable',
    insurance_stake: mode === 'insurance' ? 5 : 0, insurance_payout: 0, created_at: new Date().toISOString(),
  };
  if (mode === 'split') {
    game.player_hands.push({ ...game.player_hands[0], id: 'hand-2' });
    game.active_hand_index = 1;
  }
  const profile = {
    id: USER,
    username: "Slot Tester",
    balance: 1000,
    created_at: "2026-01-01",
    last_topup_at: null,
    avatar_url: null,
  };
  page.on("pageerror", (error) => state.errors.push(error.message));
  await page.routeWebSocket("**", (socket) => socket.close());
  await page.route(/^https?:\/\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/maintenance")
      return route.fulfill({ json: { maintenanceMode: false } });
    if (url.hostname === "127.0.0.1") return route.continue();
    if (url.hostname !== "slots-test.supabase.co")
      return route.fulfill({ status: 200, body: "" });
    const rpc = url.pathname.split("/rpc/")[1];
    if (rpc === 'get_roulette_table_snapshot') return route.fulfill({ json: { current_round: null, recent_spins: [], recent_wins: [], active_bets: [], round_participants: [] } });
    if (rpc === 'get_blackjack_table_info') return route.fulfill({ json: { deck_count: 2, cards_remaining: 100, shoe_number: 1, hands_played: 1, needs_shuffle: false } });
    if (rpc === 'get_current_blackjack_game') return route.fulfill({ json: mode === 'betting' ? null : game });
    if (rpc === 'place_roulette_table_bet') {
      const body = route.request().postDataJSON();
      state.requests.push({ rpc, body });
      return route.fulfill({ json: { id: 'bet1', user_id: USER, round_id: 'round1', bet_type: body.p_bet_type, bet_value: body.p_bet_value, stake: body.p_stake, payout: 0, status: 'pending', created_at: new Date().toISOString() } });
    }
    if (rpc === 'place_blackjack_bet' || rpc?.startsWith('blackjack_')) {
      const body = route.request().postDataJSON();
      state.requests.push({ rpc, body });
      if (rpc === 'place_blackjack_bet') {
        game.stake = body.p_stake;
        game.initial_stake = body.p_stake;
        game.player_hands[0].stake = body.p_stake;
      }
      if (rpc === 'blackjack_hit') game.player_hands[0].cards.push({ id: 'p3', suit: 'diamonds', rank: '2', value: 2 });
      if (rpc === 'blackjack_stand') { game.status = 'lost'; game.player_hands[0].status = 'lost'; game.dealer_hidden_count = 0; game.dealer_hand.push({ id: 'd2', suit: 'hearts', rank: '10', value: 10 }); }
      if (rpc === 'blackjack_decline_insurance') { game.status = 'playing'; game.insurance_status = 'declined'; }
      return route.fulfill({ json: game });
    }
    if (url.pathname === "/auth/v1/user")
      return route.fulfill({
        json: {
          id: USER,
          aud: "authenticated",
          role: "authenticated",
          email: "slots@example.invalid",
          app_metadata: {},
          user_metadata: {},
        },
      });
    if (url.pathname === "/rest/v1/profiles")
      return route.fulfill({
        json: route.request().headers().accept?.includes("object")
          ? profile
          : [profile],
      });
    if (rpc === "get_available_feature_poll")
      return route.fulfill({ json: null });
    return route.fulfill({ json: [] });
  });
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: USER, aud: "authenticated", exp: 4102444800 })).toString("base64url")}.fixture`;
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem("bsplic.theme", "dark");
      localStorage.setItem(
        "sb-slots-test-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture-only",
          token_type: "bearer",
          expires_at: 4102444800,
          expires_in: 3600,
          user: {
            id: user,
            aud: "authenticated",
            role: "authenticated",
            email: "slots@example.invalid",
            app_metadata: {},
            user_metadata: {},
            created_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    },
    { user: USER, token },
  );
  return state;
}

async function reachable(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  const nav = page.getByRole('navigation', { name: 'Nawigacja aplikacji' });
  if (await nav.isVisible()) expect(box!.y + box!.height).toBeLessThanOrEqual((await nav.boundingBox())!.y + 1);
  expect(await locator.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
}
test('roulette selection and stake are usable on mobile without hiding the bet choice', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Mobile controls');
  const state = await setup(page);
  await page.goto('/casino/roulette');
  await page.getByRole('button', { name: /Kolor x2/i }).click();
  await page.getByRole('button', { name: 'Czerwone' }).click();
  await reachable(page, page.getByRole('button', { name: 'Postaw zakład' }));
  await page.getByRole('button', { name: 'Zmień stawkę ruletki' }).click();
  await page.getByLabel('Własna kwota w zł').fill('25');
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(state.requests).toHaveLength(0);
  await page.screenshot({ path: info.outputPath('roulette.png') });
  await page.getByRole('button', { name: 'Postaw zakład' }).click();
  await expect.poll(() => state.requests.length).toBe(1);
  expect(state.requests[0].body).toMatchObject({ p_bet_type: 'color', p_bet_value: 'red', p_stake: 25 });
  expect(state.errors).toEqual([]);
});
test('blackjack stake, cards and decisions stay reachable', async ({ page }, info) => {
  const state = await setup(page);
  await page.goto('/casino/blackjack');
  await page.getByLabel('Stawka blackjacka').fill('25');
  await page.screenshot({ path: info.outputPath('blackjack-stake.png') });
  await page.getByRole('button', { name: 'Graj', exact: true }).click();
  const hit = page.getByRole('button', { name: 'Dobierz', exact: true });
  await expect(hit).toBeEnabled();
  await reachable(page, hit);
  await reachable(page, page.getByRole('button', { name: 'Pas', exact: true }));
  await expect(page.getByTestId('player-hand')).toBeInViewport();
  if (info.project.name !== 'desktop') {
    const hand = await page.getByTestId('player-hand').boundingBox();
    const controls = await page.getByTestId('blackjack-controls').boundingBox();
    expect(hand!.y + hand!.height).toBeLessThanOrEqual(controls!.y);
  }
  await page.screenshot({ path: info.outputPath('blackjack-playing.png') });
  await hit.click();
  await expect.poll(() => state.requests.at(-1)?.rpc).toBe('blackjack_hit');
  await page.getByRole('button', { name: 'Pas', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zmień stawkę' })).toBeVisible();
  expect(state.requests[0].body).toMatchObject({ p_stake: 25 });
  expect(state.errors).toEqual([]);
});
test('insurance and split hands fit a narrow screen', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'Mobile layout');
  await setup(page, 'insurance');
  await page.goto('/casino/blackjack');
  await reachable(page, page.getByRole('button', { name: 'Pomiń' }));
  await reachable(page, page.getByRole('button', { name: 'Ubezpiecz' }));
  await page.screenshot({ path: info.outputPath('blackjack-insurance.png') });
  await page.getByRole('button', { name: 'Pomiń' }).click();
  await expect(page.getByRole('button', { name: 'Dobierz' })).toBeVisible();
});
test('active split hand is visible and controls do not overlap it', async ({ page }, info) => {
  await setup(page, 'split');
  await page.goto('/casino/blackjack');
  await expect(page.getByTestId('player-hand')).toBeInViewport();
  if (info.project.name !== 'desktop') {
    const hand = await page.getByTestId('player-hand').boundingBox();
    const controls = await page.getByTestId('blackjack-controls').boundingBox();
    expect(hand!.y + hand!.height).toBeLessThanOrEqual(controls!.y);
  }
  await reachable(page, page.getByRole('button', { name: 'Dobierz' }));
  await page.screenshot({ path: info.outputPath('blackjack-split.png') });
});
test('new game covers load in the lobby', async ({ page }, info) => {
  await setup(page);
  await page.goto('/casino');
  const card = page.getByTestId('casino-roulette-card-art');
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => card.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(page.getByTestId('casino-blackjack-card-art')).toHaveAttribute('src', '/casino/blackjack-cover.webp');
  await page.screenshot({ path: info.outputPath('lobby.png') });
});
