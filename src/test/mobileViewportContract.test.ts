import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const readProjectFile = async (path: string) =>
  readFile(join(process.cwd(), path), 'utf8');

describe('mobile viewport contract', () => {
  it('uses a stable svh app shell instead of visualViewport runtime resizing', async () => {
    const [css, entrypoint] = await Promise.all([
      readProjectFile('src/index.css'),
      readProjectFile('src/main.tsx'),
    ]);

    expect(css).toMatch(
      /html,\s*body\s*{[\s\S]*overflow:\s*hidden;[\s\S]*overscroll-behavior:\s*none;/,
    );
    expect(css).toMatch(
      /#root\s*{[\s\S]*height:\s*100svh;[\s\S]*width:\s*100vw;[\s\S]*overflow:\s*hidden;/,
    );
    expect(css).toMatch(
      /\.h-safe-screen\s*{[\s\S]*height:\s*100svh;[\s\S]*height:\s*var\(--app-viewport-height,\s*100svh\);/,
    );
    // iOS standalone mode: svh/dvh report ~59pt short of the real screen,
    // only 100vh is exact there. Both the media query and the
    // navigator.standalone class fallback must size the shell with 100vh.
    expect(css).toMatch(
      /@media\s*\(display-mode:\s*standalone\),\s*\(display-mode:\s*fullscreen\)\s*{[\s\S]*--app-viewport-height:\s*100vh;/,
    );
    expect(css).toMatch(/:root\.standalone\s*{[\s\S]*--app-viewport-height:\s*100vh;/);
    expect(entrypoint).not.toContain('visualViewport');
    expect(entrypoint).not.toContain('syncAppViewportHeight');
  });

  it('marks legacy iOS webclips with a standalone class before first paint', async () => {
    const indexHtml = await readProjectFile('index.html');

    expect(indexHtml).toContain('window.navigator.standalone === true');
    expect(indexHtml).toContain("classList.add('standalone')");
  });

  it('paints the whole iOS PWA viewport behind the app shell', async () => {
    const css = await readProjectFile('src/index.css');

    expect(css).toMatch(
      /html,\s*body\s*{[\s\S]*background-color:\s*hsl\(var\(--background\)\);/,
    );
    expect(css).toMatch(
      /#root\s*{[\s\S]*background-color:\s*hsl\(var\(--background\)\);/,
    );
  });

  it('keeps rankings inside the fixed app shell with its own scroll area', async () => {
    const rankingsPage = await readProjectFile('src/pages/RankingsPage.tsx');

    expect(rankingsPage).toContain('h-safe-screen bg-background overflow-hidden flex flex-col');
    expect(rankingsPage).toContain('flex-1 min-h-0 overflow-y-auto');
    expect(rankingsPage).not.toContain('min-h-screen bg-background');
  });

  it('uses the app viewport variable for mobile overlay height caps', async () => {
    const overlayFiles = await Promise.all([
      readProjectFile('src/components/CouponDrawer.tsx'),
      readProjectFile('src/components/ProposeBetModal.tsx'),
      readProjectFile('src/features/admin/components/ProposalsTab.tsx'),
      readProjectFile('src/features/admin/components/ManageBetsTab.tsx'),
      readProjectFile('src/features/social/components/ReactorsDialog.tsx'),
    ]);

    const joined = overlayFiles.join('\n');

    expect(joined).not.toMatch(/(?:max-h|h)-\[[^\]]*\d+vh[^\]]*\]/);
    expect(joined).toContain('var(--app-viewport-height');
  });

  it('keeps floating mobile CTAs stacked around the bottom navigation state', async () => {
    const [css, couponDrawer] = await Promise.all([
      readProjectFile('src/index.css'),
      readProjectFile('src/components/CouponDrawer.tsx'),
    ]);

    expect(css).toContain('--mobile-floating-stack-offset: 4.75rem');
    expect(css).toMatch(
      /body\.mobile-bottom-nav-hidden\s*{[\s\S]*--mobile-floating-stack-offset:\s*0rem;/,
    );
    expect(css).toMatch(
      /\.bonus-campaign-cta-visible\s+\.coupon-mobile-trigger\s*{[\s\S]*bottom:\s*calc\(4\.5rem\s*\+\s*var\(--mobile-floating-stack-offset,\s*4\.75rem\)\s*\+\s*env\(safe-area-inset-bottom\)\);/,
    );
    expect(couponDrawer).toContain('var(--mobile-floating-stack-offset,4.75rem)');
  });
});
