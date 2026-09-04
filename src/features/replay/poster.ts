import { formatReplayMoney, replayChart, type ReplayModel } from './model';

/** Locally rendered only: no screenshots, external images, uploads or account IDs. */
export async function createReplayPoster(model: ReplayModel, name?: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Ta przeglądarka nie obsługuje tworzenia plakatu.');

  const text = (value: string, x: number, y: number, size: number, color = '#fff6ee', width = 904) => {
    context.font = `900 ${size}px Arial, sans-serif`;
    context.fillStyle = color;
    context.fillText(value, x, y, width);
  };
  const gradient = context.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, '#1a0712');
  gradient.addColorStop(0.55, '#630c2a');
  gradient.addColorStop(1, '#0d080e');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1920);
  context.strokeStyle = '#ff315d';
  context.lineWidth = 2;
  for (let radius = 260; radius <= 660; radius += 100) {
    context.beginPath();
    context.arc(1070, 580, radius, 0, Math.PI * 2);
    context.stroke();
  }
  context.fillStyle = '#ffcf33';
  context.fillRect(80, 92, 230, 58);
  text('BSPLIC 2.0', 97, 133, 31, '#160b0f', 195);
  text('MÓJ', 72, 365, 170);
  text('REPLAY.', 72, 555, 170);
  text(model.periodLabel.toUpperCase(), 85, 655, 35, '#ffcf33');
  const safeName = name ? Array.from(name.replace(/[\r\n\t]/g, ' ')).slice(0, 40).join('') : 'Twoja gra. Twoja historia.';
  text(safeName, 85, 728, 38);

  context.fillStyle = '#100a11';
  context.fillRect(64, 820, 952, 720);
  text('BILANS ROZLICZONYCH', 98, 891, 26, '#d9bbc9');
  text(formatReplayMoney(model.netCents, true), 92, 1012, 100, model.netCents < 0 ? '#ffacbd' : '#ffcf33', 880);
  const chart = replayChart(model.timeline.map((moment) => moment.cumulativeCents));
  context.save();
  context.translate(82, 1050);
  context.scale(0.91, 0.65);
  context.strokeStyle = '#ffcf33';
  context.lineWidth = 5;
  context.beginPath();
  chart.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();
  context.restore();
  text(String(model.coupons.length), 100, 1408, 92);
  text(model.winRate === null ? '—' : `${model.winRate}%`, 580, 1408, 92);
  text('KUPONY', 100, 1466, 26, '#d9bbc9');
  text('TRAFNOŚĆ W/L', 580, 1466, 26, '#d9bbc9');
  text(model.rangeLabel, 83, 1630, 27);
  text(model.coverageLabel, 83, 1690, 27, '#ffcf33');
  text('Według daty postawienia · tylko sportsbook', 83, 1745, 24, '#d9bbc9');
  text('Zabawa za wirtualne zł. To nie saldo konta.', 83, 1790, 24, '#d9bbc9');
  text('BEZ FILTRA. PO TWOJEMU.', 83, 1860, 31);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Nie udało się przygotować obrazu. Spróbuj ponownie.'));
    }, 'image/png');
  });
}
