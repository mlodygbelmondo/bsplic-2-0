import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const stylesDir = join(process.cwd(), 'src/features/jackpot/styles');

describe('jackpot style ownership', () => {
  it('keeps card and draw page styles in separate feature stylesheets', () => {
    const cardPath = join(stylesDir, 'dailyJackpotCard.css');
    const drawPath = join(stylesDir, 'jackpotDrawPage.css');

    expect(existsSync(cardPath)).toBe(true);
    expect(existsSync(drawPath)).toBe(true);

    const cardCss = readFileSync(cardPath, 'utf8');
    const drawCss = readFileSync(drawPath, 'utf8');

    expect(cardCss).toContain('.daily-jackpot-card');
    expect(cardCss).not.toContain('.jackpot-draw-page');
    expect(drawCss).toContain('.jackpot-draw-page');
    expect(drawCss).not.toContain('.daily-jackpot-card');
  });
});
