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
    expect(css).not.toContain('--app-viewport-height: 100dvh');
    expect(entrypoint).not.toContain('visualViewport');
    expect(entrypoint).not.toContain('syncAppViewportHeight');
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
});
