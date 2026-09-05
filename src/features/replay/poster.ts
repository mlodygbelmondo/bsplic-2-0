import { formatReplayMoney, replayChart, type ReplayModel } from './model';

/** The export uses the currently selected app theme, not a second brand palette. */
function posterTheme() {
  const style = getComputedStyle(document.documentElement);
  const color = (token: string, fallback: string) => {
    const value = style.getPropertyValue(`--${token}`).trim();
    return value ? `hsl(${value})` : fallback;
  };
  return {
    background: color('background', '#ffffff'),
    card: color('card', '#ffffff'),
    foreground: color('foreground', '#111111'),
    muted: color('muted-foreground', '#555555'),
    primary: color('primary', '#111111'),
    border: color('border', '#dddddd'),
    negative: color('destructive', '#111111'),
    font: getComputedStyle(document.body).fontFamily || 'sans-serif',
  };
}

/** Locally rendered only: no external images, uploads, account IDs or coupon details. */
export async function createReplayPoster(model: ReplayModel, name?: string): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Ta przeglądarka nie obsługuje tworzenia plakatu.');
  const theme = posterTheme();
  const text = (value: string, x: number, y: number, size: number, color = theme.foreground, width = 920, weight = 600) => {
    // Fit without horizontally stretching either numbers or long opt-in names.
    let fitted = size;
    context.font = `${weight} ${fitted}px ${theme.font}`;
    while (context.measureText(value).width > width && fitted > 16) {
      fitted -= 1;
      context.font = `${weight} ${fitted}px ${theme.font}`;
    }
    context.fillStyle = color;
    context.fillText(value, x, y, width);
  };
  const rule = (y: number) => {
    context.fillStyle = theme.border;
    context.fillRect(80, y, 920, 2);
  };

  context.fillStyle = theme.background;
  context.fillRect(0, 0, 1080, 1920);
  text('BSPLIC 2.0', 80, 120, 36, theme.primary, 500, 800);
  text(model.periodLabel, 690, 120, 28, theme.muted, 310, 500);
  text('Replay', 74, 308, 126, theme.foreground, 920, 750);
  const safeName = name ? Array.from(name.replace(/[\r\n\t]/g, ' ')).slice(0, 40).join('') : undefined;
  if (safeName) text(safeName, 80, 375, 34, theme.foreground, 920, 500);
  text(model.rangeLabel, 80, 440, 28, theme.muted, 920, 500);
  rule(495);

  text('Wynik netto', 80, 590, 32, theme.muted, 920, 500);
  text(model.settledCount ? formatReplayMoney(model.netCents, true) : '—', 74, 730, 112, model.netCents < 0 ? theme.negative : theme.foreground);
  text(model.settledCount ? 'Rozliczone kupony' : 'Kupony czekają na rozliczenie', 80, 798, 28, theme.muted, 920, 500);
  if (model.timeline.length) {
    const chart = replayChart(model.timeline.map((moment) => moment.cumulativeCents));
    context.save();
    context.translate(60, 860);
    context.scale(0.96, 1.1);
    context.strokeStyle = theme.border;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(24, chart.zeroY);
    context.lineTo(976, chart.zeroY);
    context.stroke();
    context.strokeStyle = theme.primary;
    context.lineWidth = 5;
    context.lineJoin = 'round';
    context.beginPath();
    chart.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();
    context.restore();
  }
  rule(1260);
  text('Kupony', 80, 1345, 30, theme.muted, 400, 500);
  text('Trafność', 570, 1345, 30, theme.muted, 430, 500);
  text(String(model.coupons.length), 80, 1460, 92);
  text(model.winRate === null ? '—' : `${model.winRate}%`, 570, 1460, 92, theme.foreground, 430);
  rule(1555);
  if (model.limited) text('Część historii · limit 200 kuponów', 80, 1640, 28, theme.foreground, 920, 500);
  text('Sportsbook · wirtualne zł', 80, 1730, 30, theme.foreground, 920, 500);
  text('Wynik kuponów, nie saldo konta.', 80, 1795, 26, theme.muted, 920, 500);
  text('Według daty postawienia · maks. 200 kuponów', 80, 1850, 24, theme.muted, 920, 500);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Nie udało się przygotować obrazu. Spróbuj ponownie.'));
    }, 'image/png');
  });
}
