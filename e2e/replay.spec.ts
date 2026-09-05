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
async function setup(page: Page, options: { signedIn?: boolean; rows?: unknown; fail?: boolean; theme?: 'dark' | 'light' } = {}) {
  const state = { rows: options.rows ?? fixtures(), fail: options.fail ?? false, reads: [] as Record<string, unknown>[], writes: [] as string[], errors: [] as string[] };
  const profile = { id: USER, username: 'Astra Demo', balance: 1000, current_streak: 3, longest_streak: 5, created_at: '2026-01-01T12:00:00Z', last_bet_date: null, last_topup_at: null, avatar_url: null };
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((theme) => localStorage.setItem('bsplic.theme', theme), options.theme ?? 'dark');
  page.on('pageerror', (error) => state.errors.push(error.message));
  await page.routeWebSocket('**', (socket) => socket.close());
  // Only intercept network traffic. WebKit also routes blob: images, which
  // must remain browser-local rather than becoming an empty fixture response.
  await page.route(/^https?:\/\//, async (route) => {
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

const summary = (page: Page) => page.getByRole('region', { name: 'Bilans kuponów', exact: true });
const history = (page: Page) => page.getByRole('region', { name: 'Kupony', exact: true });

async function noOverflow(page: Page) {
  expect(await page.locator('main.replay-page').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
}

async function ready(page: Page) {
  await expect(summary(page)).toBeVisible();
  await expect(page.locator('#initial-splash')).toHaveCount(0);
}

test('opens directly on the summary inside the app, with no intro or chapters', async ({ page }, info) => {
  const state = await setup(page);
  await page.goto('/replay');
  await expect(page).toHaveURL(/\/replay$/);
  await ready(page);
  await expect(page.getByRole('heading', { name: 'Replay', exact: true })).toBeVisible();
  await expect(page.getByRole('slider')).toBeVisible();
  await expect(page.getByRole('button', { name: /Rozdział|Dalej|Odtwórz/ })).toHaveCount(0);
  expect(state.reads).toEqual([{ p_user_id: USER, p_limit: 201, p_offset: 0 }]);
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('summary-dark.png'), animations: 'disabled' });
  await page.getByText('Jak liczymy?', { exact: true }).click();
  await expect(page.getByText(/Bilans to wypłaty minus stawki/)).toBeVisible();
  const slider = page.getByRole('slider');
  await slider.focus();
  const before = Number(await slider.inputValue());
  await slider.press('ArrowLeft');
  await expect(slider).toHaveValue(String(before - 1));
  expect(state.errors).toEqual([]);
  expect(state.writes).toEqual([]);
});

test('filters history, expands a coupon with the keyboard, and loads more without network calls', async ({ page }, info) => {
  const state = await setup(page);
  await page.goto('/replay');
  await ready(page);
  await expect(history(page).locator('.replay-coupon-row')).toHaveCount(20);
  const first = history(page).locator('summary').first();
  await first.focus();
  await first.press('Enter');
  await expect(history(page).locator('.replay-coupon-row').first()).toHaveAttribute('open', '');
  await expect(history(page).locator('.replay-coupon-row').first().getByText('Stawka', { exact: true })).toBeVisible();
  await history(page).getByRole('button', { name: /^Wygrane/ }).click();
  await expect(history(page).getByText('Przegrany', { exact: true })).toHaveCount(0);
  await history(page).getByRole('button', { name: 'Wszystkie', exact: true }).click();
  await history(page).getByRole('button', { name: 'Pokaż więcej' }).click();
  await expect(history(page).locator('.replay-coupon-row')).toHaveCount(40);
  await history(page).locator('summary').first().click();
  await history(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath('summary-history.png'), animations: 'disabled' });
  expect(state.reads).toHaveLength(1);
  expect(state.errors).toEqual([]);
});

test('exports a real PNG only on demand, supports name consent, closes and reopens safely', async ({ page }, info) => {
  const assets: string[] = [];
  page.on('request', (request) => assets.push(request.url()));
  const state = await setup(page);
  await page.goto('/replay');
  await ready(page);
  expect(assets.filter((url) => /\/assets\/poster-/.test(url))).toEqual([]);
  await expect(page.locator('.replay-poster-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'Udostępnij', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const image = dialog.getByRole('img', { name: /bez nicku/ });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 1080)).toBe(true);
  await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Zapisz PNG' }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1920);
  await download.saveAs(info.outputPath('bsplic-replay.png'));
  await dialog.getByRole('checkbox').check();
  const namedImage = dialog.getByRole('img', { name: /gracza Astra Demo/ });
  await expect(namedImage).toBeVisible();
  await expect.poll(() => namedImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 1080)).toBe(true);
  await page.screenshot({ path: info.outputPath('summary-share.png'), animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Zamknij' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Udostępnij', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Udostępnij', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('dialog').getByRole('img', { name: /bez nicku/ })).toBeVisible();
  expect(state.writes).toEqual([]);
  expect(state.errors).toEqual([]);
});

test('signed-out visitors cannot fetch history or load the Replay chunk on the authenticated route', async ({ page }) => {
  const assets: string[] = [];
  page.on('request', (request) => assets.push(request.url()));
  const state = await setup(page, { signedIn: false });
  for (const path of ['/replay']) {
    await page.goto(path);
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  }
  expect(state.reads).toEqual([]);
  expect(assets.filter((url) => /\/assets\/ReplayPage-/.test(url))).toEqual([]);
});

test('own profile links to the summary; another profile does not', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/profile');
  await page.getByRole('link', { name: /Replay Bilans/ }).click();
  await ready(page);
  await page.getByRole('link', { name: 'Do profilu', exact: true }).click();
  await expect(page.getByRole('link', { name: /Replay Bilans/ })).toBeVisible();
  await page.goto('/profile/22222222-2222-4222-8222-222222222222');
  await expect(page.getByRole('heading', { name: 'Inny Gracz' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Replay Bilans/ })).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test('failed requests are recoverable and a failed refresh preserves the snapshot', async ({ page }) => {
  const state = await setup(page, { fail: true });
  await page.goto('/replay');
  await expect(page.getByRole('alert')).toContainText('Nie udało się wczytać');
  state.fail = false;
  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await ready(page);
  const net = await summary(page).locator('.replay-net').innerText();
  state.fail = true;
  await page.getByRole('button', { name: 'Odśwież Replay' }).click();
  await expect(page.getByRole('alert')).toContainText('poprzedni zapis');
  await expect(summary(page).locator('.replay-net')).toHaveText(net);
});

test('empty or old history has a useful state without pushing new bets', async ({ page }) => {
  const state = await setup(page, { rows: [] });
  await page.goto('/replay');
  await expect(page.getByRole('region', { name: 'Pusty Replay' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Udostępnij', exact: true })).toHaveCount(0);
  state.rows = [{ ...fixtures(1)[0], created_at: '2026-01-01T00:00:00Z' }];
  await page.getByRole('button', { name: 'Odśwież Replay' }).click();
  await expect(page.getByRole('button', { name: 'Odśwież Replay' })).toBeEnabled();
  await page.getByRole('button', { name: 'Zobacz ostatnie kupony' }).click();
  await ready(page);
  await expect(page.getByRole('slider')).toHaveCount(0);
});

test('period filters are local; light theme and reduced motion use the app tokens', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await setup(page, { theme: 'light' });
  await page.goto('/replay');
  await ready(page);
  await expect(page.locator('html')).toHaveClass(/light/);
  await page.getByRole('button', { name: '7 dni', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 dni', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(state.reads).toHaveLength(1);
  await expect(summary(page)).toHaveCSS('animation-name', 'none');
  await noOverflow(page);
  await page.screenshot({ path: info.outputPath('summary-light.png'), animations: 'disabled' });
});

test('320px viewport and long titles work without horizontal page overflow', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const rows = fixtures(3).map((row) => ({ ...row, legs: row.legs.map((leg) => ({ ...leg, bet_title: 'BardzoDługiTytułBezSpacji'.repeat(12) })) }));
  const state = await setup(page, { rows });
  await page.goto('/replay');
  await ready(page);
  await noOverflow(page);
  await history(page).locator('summary').first().click();
  await noOverflow(page);
  await page.locator('.replay-page').evaluate((el) => el.scrollTop = 0);
  await page.screenshot({ path: info.outputPath('summary-320.png'), animations: 'disabled' });
  expect(state.errors).toEqual([]);
});

test('dense history discloses the cap and all 200 coupons remain inspectable', async ({ page }) => {
  const rows = fixtures(201).map((row, i) => ({ ...row, created_at: new Date(NOW - (i + 1) * 60_000).toISOString() }));
  const state = await setup(page, { rows });
  await page.goto('/replay');
  await ready(page);
  await expect(page.getByRole('status').filter({ hasText: 'Zakres jest częściowy' })).toBeVisible();
  for (let i = 0; i < 9; i++) await history(page).getByRole('button', { name: 'Pokaż więcej' }).click();
  await expect(history(page).locator('.replay-coupon-row')).toHaveCount(200);
  await history(page).locator('summary').last().click();
  await expect(history(page).locator('.replay-coupon-row').last()).toHaveAttribute('open', '');
  expect(state.reads).toHaveLength(1);
  expect(state.errors).toEqual([]);
});

test('losses, pending coupons and replacement snapshots update without stale chart state', async ({ page }) => {
  const state = await setup(page, { rows: fixtures(3).map((row) => ({ ...row, status: 'lost', payout: 0 })) });
  await page.goto('/replay');
  await ready(page);
  await expect(summary(page).locator('.replay-net')).toContainText('-150,00 zł');
  await page.getByRole('slider').focus();
  await page.getByRole('slider').press('Home');
  state.rows = [{ ...fixtures(1)[0], status: 'pending', payout: 0 }];
  await page.getByRole('button', { name: 'Odśwież Replay' }).click();
  await expect(summary(page).locator('.replay-net')).toHaveText('—');
  await expect(page.getByRole('slider')).toHaveCount(0);
  state.rows = [{ ...fixtures(1)[0], id: 'replacement', status: 'won', stake: 10, payout: 25 }];
  await page.getByRole('button', { name: 'Odśwież Replay' }).click();
  await expect(summary(page).locator('.replay-net')).toHaveText('+15,00 zł');
  await expect(page.getByRole('slider')).toBeDisabled();
  expect(state.errors).toEqual([]);
});
