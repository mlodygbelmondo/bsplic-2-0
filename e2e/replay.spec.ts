import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const NOW = Date.parse('2026-09-04T12:00:00Z');
const USER = '11111111-1111-4111-8111-111111111111';
const statuses = ['pending', 'lost', 'won', 'won', 'refund', 'lost', 'won'];
function fixtures(count = 48) {
  return Array.from({ length: count }, (_, index) => {
    const status = statuses[index % 7];
    const stake = 25 + index % 4 * 25;
    const odds = 1.5 + index % 8 * 0.75;
    return {
      id: `fixture-${index}`, status, stake, total_odds: odds,
      payout: status === 'won' ? stake * odds : status === 'refund' ? stake : 0,
      created_at: new Date(NOW - (index * 16 + 2) * 3_600_000).toISOString(),
      legs: [{ id: `leg-${index}`, bet_id: `bet-${index}`, selected_option: 'Gospodarze', odds_at_time: odds, result: status, bet_title: ['Wieczór derbowy', 'Finał pod światłami', 'Mecz o wszystko'][index % 3] }],
    };
  });
}

// Real production UI + deterministic HTTP fixtures; no app auth bypass and no live writes.
async function setup(page: Page, options: { signedIn?: boolean; rows?: unknown; fail?: boolean } = {}) {
  const state = { rows: options.rows ?? fixtures(), fail: options.fail ?? false, reads: [] as Record<string, unknown>[], writes: [] as string[], errors: [] as string[] };
  const profile = { id: USER, username: 'Astra Demo', balance: 1000, current_streak: 3, longest_streak: 5, created_at: '2026-01-01T12:00:00Z', last_bet_date: null, last_topup_at: null, avatar_url: null };
  await page.clock.setFixedTime(NOW);
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.routeWebSocket('**', (socket) => socket.close());
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/api/maintenance') return route.fulfill({ json: { maintenanceMode: false } });
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'replay-test.supabase.co') return route.fulfill({ status: 200, body: '', contentType: 'text/plain' });
    const rpc = url.pathname.split('/rpc/')[1];
    if (rpc === 'get_user_coupon_history') {
      state.reads.push(request.postDataJSON());
      return route.fulfill(state.fail ? { status: 503, json: { message: 'Test unavailable' } } : { json: state.rows });
    }
    if (rpc === 'get_available_feature_poll') return route.fulfill({ json: null });
    if (rpc === 'get_user_stats') return route.fulfill({ json: [{ total_bets: 48, won_bets: 20, lost_bets: 14, win_rate: 59, total_profit: 100 }] });
    if (rpc === 'get_public_profile') return route.fulfill({ json: { ...profile, id: '22222222-2222-4222-8222-222222222222', username: 'Inny Gracz', total_bets: 0, won_bets: 0, lost_bets: 0, win_rate: 0, total_profit: 0 } });
    if (rpc?.startsWith('get_')) return route.fulfill({ json: [] });
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid', app_metadata: {}, user_metadata: {} } });
    if (request.method() !== 'GET' && request.method() !== 'OPTIONS') {
      state.writes.push(url.pathname);
      return route.fulfill({ status: 403, json: { message: 'No writes allowed in Replay tests' } });
    }
    if (url.pathname === '/rest/v1/profiles') return route.fulfill({ json: request.headers().accept?.includes('object') ? profile : [profile] });
    return route.fulfill({ json: [] });
  });
  if (options.signedIn !== false) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: USER, aud: 'authenticated', role: 'authenticated', exp: 4102444800 })).toString('base64url');
    await page.addInitScript(({ user, token }) => {
      localStorage.setItem('sb-replay-test-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture-only', token_type: 'bearer', expires_at: 4102444800, expires_in: 3600, user: { id: user, aud: 'authenticated', role: 'authenticated', email: 'demo@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }));
    }, { user: USER, token: `${header}.${payload}.fixture` });
  }
  return state;
}

const chapter = (page: Page, index: number) => page.getByRole('button', { name: new RegExp(`^Rozdział ${index}:`) });
async function noOverflow(page: Page) {
  expect(await page.locator('main.replay-page').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
}

test('production app: five chapters, chart, map and real PNG export', async ({ page }, info) => {
  const state = await setup(page);
  await page.goto('/replay');
  await expect(chapter(page, 1)).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { name: /Twoja gra/ })).toBeVisible();
  expect(state.reads[0]).toEqual({ p_user_id: USER, p_limit: 201, p_offset: 0 });
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('replay-opening.png'), fullPage: true });
  await chapter(page, 2).click();
  const slider = page.getByRole('slider');
  await slider.focus();
  const old = await slider.inputValue();
  await slider.press('ArrowLeft');
  expect(Number(await slider.inputValue())).toBe(Number(old) - 1);
  await expect(chapter(page, 2)).toHaveAttribute('aria-current', 'step');
  await page.screenshot({ path: info.outputPath('replay-balance.png'), fullPage: true });
  await chapter(page, 3).click();
  await page.getByText(/Szczegóły kuponu/).click();
  await expect(page.locator('.replay-legs')).toBeVisible();
  await chapter(page, 4).click();
  await page.locator('.replay-map button').first().click();
  await expect(page.locator('.replay-map button').first()).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath('replay-map.png'), fullPage: true });
  await chapter(page, 5).click();
  await expect(page.getByRole('img', { name: /bez nicku/ })).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Zapisz PNG' }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1920);
  await download.saveAs(info.outputPath('bsplic-replay.png'));
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('img', { name: /gracza Astra Demo/ })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('replay-finale.png'), fullPage: true });
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('signed-out visitors cannot fetch history or load the Replay route chunk', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', (request) => assets.push(request.url()));
  const state = await setup(page, { signedIn: false });
  await page.goto('/replay');
  await expect(page.locator('input[type="password"]').first()).toBeVisible();
  expect(state.reads).toEqual([]);
  expect(assets.filter((url) => /\/assets\/ReplayPage-/.test(url))).toEqual([]);
});

test('own profile provides a working entry point; another profile does not', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/profile');
  await page.getByRole('link', { name: /BSPLIC Replay/ }).click();
  await expect(chapter(page, 1)).toHaveAttribute('aria-current', 'step');
  await page.getByRole('link', { name: 'Do profilu' }).click();
  await expect(page.getByRole('link', { name: /BSPLIC Replay/ })).toBeVisible();
  await page.goto('/profile/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('heading', { name: 'Inny Gracz' })).toBeVisible();
  await expect(page.getByRole('link', { name: /BSPLIC Replay/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('network failure is recoverable and a failed refresh preserves the last snapshot', async ({ page }) => {
  const state = await setup(page, { fail: true });
  await page.goto('/replay');
  await expect(page.getByRole('alert')).toContainText('Nie udało się wczytać');
  state.fail = false;
  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(chapter(page, 1)).toHaveAttribute('aria-current', 'step');
  state.fail = true;
  await page.getByRole('button', { name: 'Odśwież Replay' }).click();
  await expect(page.getByRole('alert')).toContainText('poprzedni zapis');
  await expect(chapter(page, 1)).toBeVisible();
});

test('empty history and old history have useful honest states', async ({ page }) => {
  const state = await setup(page, { rows: [] });
  await page.goto('/replay');
  await expect(page.getByRole('region', { name: 'Pusty Replay' })).toBeVisible();
  state.rows = [{ ...fixtures(1)[0], created_at: '2026-01-01T00:00:00Z' }];
  await page.getByRole('button', { name: 'Odśwież Replay' }).click();
  await expect(page.getByRole('button', { name: 'Odśwież Replay' })).toBeEnabled();
  await page.getByRole('button', { name: 'Zobacz ostatnie kupony' }).click();
  await expect(chapter(page, 1)).toHaveAttribute('aria-current', 'step');
});

test('period filters are local and reduced motion disables autoplay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await setup(page);
  await page.goto('/replay');
  await expect(chapter(page, 1)).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', { name: '7 dni', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 dni', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(state.reads).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Odtwórz automatycznie' })).toBeDisabled();
  await expect(page.locator('.replay-scene')).toHaveCSS('animation-name', 'none');
});

test('320px view and long user content remain usable across all chapters', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const rows = fixtures(3).map((row) => ({ ...row, legs: row.legs.map((leg) => ({ ...leg, bet_title: 'BardzoDługiTytułBezSpacji'.repeat(12) })) }));
  const state = await setup(page, { rows });
  await page.goto('/replay');
  for (let index = 1; index <= 5; index += 1) {
    await chapter(page, index).click();
    await noOverflow(page);
  }
  expect(state.errors).toEqual([]);
});
