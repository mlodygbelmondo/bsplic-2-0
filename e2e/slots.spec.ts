import { test, expect, type Page } from "@playwright/test";
const USER = "11111111-1111-4111-8111-111111111111";
async function setup(
  page: Page,
  options: { failFirst?: boolean; free?: boolean } = {},
) {
  const state = {
    requests: [] as { p_request_id: string; p_game: string; p_stake: number }[],
    errors: [] as string[],
    history: [] as unknown[],
  };
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
    if (rpc === "casino_slot_state")
      return route.fulfill({
        json: {
          boostRemaining: 15,
          freeSpins: options.free ? 3 : 0,
          bonusStake: 5,
          history: state.history,
        },
      });
    if (rpc === "casino_slot_spin") {
      const request = route.request().postDataJSON();
      state.requests.push(request);
      if (options.failFirst && state.requests.length === 1)
        return route.abort("failed");
      const board = Array.from(
        { length: 30 },
        (_, i) => (i * 3 + Math.floor(i / 6)) % 7,
      );
      const result = {
        id: request.p_request_id,
        game: request.p_game,
        stake: request.p_stake,
        charged: 5,
        payout: 2,
        net: -3,
        balance: 997,
        boosted: true,
        boostRemaining: 14,
        freeSpins: 0,
        awardedFreeSpins: 0,
        createdAt: new Date().toISOString(),
        frames: [
          {
            board,
            gold: Array(30).fill(0),
            groups: [],
            multiplier: 1,
            payout: 2,
          },
        ],
      };
      state.history = [result];
      profile.balance = 997;
      return route.fulfill({ json: result });
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
for (const game of ["bandit", "candy"]) {
  test(`${game}: layout, spin, net loss and stop`, async ({ page }, info) => {
    const state = await setup(page);
    await page.goto(`/casino/slots/${game}`);
    await expect(page.getByRole("button", { name: "ZAKRĘĆ" })).toBeEnabled();
    await expect(page.locator("#initial-splash")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ZAKRĘĆ" })).toBeInViewport();
    if (info.project.name === "phone") {
      const spinBox = await page
        .getByRole("button", { name: "ZAKRĘĆ" })
        .boundingBox();
      const navBox = await page
        .getByRole("navigation", { name: "Nawigacja aplikacji" })
        .boundingBox();
      expect(spinBox!.y + spinBox!.height).toBeLessThan(navBox!.y);
    }
    await page.screenshot({
      path: info.outputPath(`${game}-ready.png`),
      fullPage: true,
      animations: "disabled",
    });
    expect(
      await page
        .locator(".slots-page")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await page.getByRole("button", { name: "ZAKRĘĆ" }).click();
    await expect(page.getByText("Strata netto · wypłata 2,00")).toBeVisible();
    expect(state.requests).toHaveLength(1);
    await page.getByRole("button", { name: "Zasady i wypłaty" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Zakończ sesję" }).click();
    await expect(page.getByRole("button", { name: "ZAKRĘĆ" })).toBeDisabled();
    expect(state.errors).toEqual([]);
  });
}
test("retries the same request after lost response, including after reload", async ({
  page,
}) => {
  const state = await setup(page, { failFirst: true });
  await page.goto("/casino/slots/bandit");
  await page.getByRole("button", { name: "ZAKRĘĆ" }).click();
  await expect(
    page.getByRole("button", { name: "SPRAWDŹ OBRÓT" }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "SPRAWDŹ OBRÓT" }).click();
  await expect(page.getByText("Strata netto · wypłata 2,00")).toBeVisible();
  expect(state.requests).toHaveLength(2);
  expect(state.requests[0]).toEqual(state.requests[1]);
});
test("lobby exposes all four games and one mobile Games tab", async ({
  page,
}, info) => {
  await setup(page);
  await page.goto("/casino");
  for (const name of [
    "Midnight Bandit",
    "Candy Cascade",
    "Ruletka",
    "Blackjack",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  if (info.project.name === "phone") {
    await expect(
      page.getByRole("link", { name: "Gry", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await page
        .getByRole("navigation", { name: "Nawigacja aplikacji" })
        .getByRole("link")
        .count(),
    ).toBe(5);
  }
  await page.screenshot({ path: info.outputPath("lobby.png"), fullPage: true });
});

test("spin remains reachable on a compact phone", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await setup(page);
  await page.goto("/casino/slots/bandit");
  const button = page.getByRole("button", { name: "ZAKRĘĆ" });
  await expect(button).toBeEnabled();
  const spinBox = await button.boundingBox();
  const navBox = await page.getByRole("navigation", { name: "Nawigacja aplikacji" }).boundingBox();
  expect(spinBox!.y + spinBox!.height).toBeLessThan(navBox!.y);
  expect(await page.locator('.slots-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('compact-phone.png'), animations: 'disabled' });
});
