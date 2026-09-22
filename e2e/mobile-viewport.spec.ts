import { expect, test } from '@playwright/test';

for (const standalone of [false, true]) {
  test(`the mobile app shell fills the viewport${standalone ? ' in a legacy standalone webclip' : ''}`, async ({ page }) => {
    if (standalone) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'standalone', { value: true });
      });
    }

    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.querySelector('#root')!.getBoundingClientRect();
      return {
        rootHeight: root.height,
        rootWidth: root.width,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        standaloneClass: document.documentElement.classList.contains('standalone'),
      };
    });

    expect(layout.standaloneClass).toBe(standalone);
    expect(layout.rootHeight).toBeCloseTo(layout.viewportHeight, 0);
    expect(layout.rootWidth).toBeCloseTo(layout.viewportWidth, 0);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  });
}
