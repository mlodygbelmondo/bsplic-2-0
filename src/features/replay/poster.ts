import { formatReplayMoney, replayChart, type ReplayModel } from './model';

/** On-device export. No remote images, uploads, account IDs or font downloads. */
export async function createReplayPoster(model: ReplayModel, name?: string): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Ta przeglądarka nie obsługuje eksportu PNG.');

  const styles = getComputedStyle(document.documentElement);
  const color = (token: string, fallback: string) => {
    const value = styles.getPropertyValue(`--${token}`).trim();
    return value ? `hsl(${value})` : fallback;
  };
  const background = color('background', '#090005');
  const card = color('card', '#1a0810');
  const foreground = color('foreground', '#fff5f5');
  const muted = color('muted-foreground', '#d8b4bc');
  const accent = color('primary', '#ff0a54');
  const border = color('border', '#3d1e28');
  const font = getComputedStyle(document.body).fontFamily || 'Inter, Arial, sans-serif';
  const text = (value: string, x: number, y: number, size: number, fill = foreground, weight = 600, width = 904) => {
    let fitted = size;
    context.font = `${weight} ${fitted}px ${font}`;
    while (context.measureText(value).width > width && fitted > 16) {
      fitted -= 1;
      context.font = `${weight} ${fitted}px ${font}`;
    }
    context.fillStyle = fill;
    context.fillText(value, x, y, width);
  };
  const rule = (y: number) => {
    context.strokeStyle = border;
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(88, y); context.lineTo(992, y); context.stroke();
  };

  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1920);
  context.fillStyle = accent;
  context.fillRect(88, 88, 64, 6);
  text('BSPLIC 2.0', 88, 160, 34, foreground, 700);
  text('Replay', 80, 340, 144, foreground, 800);
  text(model.periodLabel, 88, 415, 34, muted, 500);
  if (name) {
    const safeName = Array.from(name.replace(/[\r\n\t]/g, ' ')).slice(0, 40).join('');
    text(safeName, 88, 480, 36, foreground, 600);
  }
  rule(540);
  text('Bilans', 88, 620, 34, muted, 500);
  text(model.settledCount ? formatReplayMoney(model.netCents, true) : 'Brak rozliczeń', 80, 760, 112, foreground, 800);

  context.fillStyle = card;
  context.fillRect(64, 828, 952, 414);
  if (model.timeline.length) {
    const chart = replayChart(model.timeline.map((moment) => moment.cumulativeCents));
    context.save();
    context.translate(84, 860);
    context.scale(0.91, 1.08);
    context.strokeStyle = border;
    context.lineWidth = 2;
    context.beginPath(); context.moveTo(24, chart.zeroY); context.lineTo(976, chart.zeroY); context.stroke();
    context.strokeStyle = accent;
    context.lineWidth = 5;
    context.lineJoin = 'round';
    context.beginPath();
    chart.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();
    context.restore();
  } else {
    text('Kupony czekają na rozliczenie', 100, 1050, 36, muted, 500, 880);
  }

  const metrics = [
    [String(model.coupons.length), 'Kupony'],
    [model.winRate === null ? '—' : `${model.winRate}%`, 'Skuteczność'],
    [model.settledCount ? formatReplayMoney(model.stakeCents) : '—', 'Stawki rozliczonych'],
    [model.settledCount ? formatReplayMoney(model.payoutCents) : '—', 'Wypłaty rozliczonych'],
  ];
  metrics.forEach(([value, label], index) => {
    const x = index % 2 === 0 ? 88 : 570;
    const y = index < 2 ? 1375 : 1575;
    text(value, x, y, 58, foreground, 700, 422);
    text(label, x, y + 55, 28, muted, 500, 422);
  });
  rule(1690);
  text(model.rangeLabel, 88, 1755, 29, foreground, 500);
  text(model.limited ? 'Część historii · 200 najnowszych kuponów' : 'Zakłady · wirtualne zł', 88, 1810, 28, muted, 500);
  text('Wirtualne zł. Bilans kuponów, nie saldo konta.', 88, 1860, 26, muted, 400);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Nie udało się przygotować PNG. Spróbuj ponownie.'));
    }, 'image/png');
  });
}
