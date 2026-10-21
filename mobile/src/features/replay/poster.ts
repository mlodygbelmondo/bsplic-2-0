import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import {
  FontWeight,
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeJoin,
  type SkCanvas,
  type SkParagraph,
  type SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { Image } from 'react-native';

import type { Colors } from '@/theme';
import type { ReplayModel } from './model';
import {
  POSTER_HEIGHT,
  POSTER_WIDTH,
  replayPosterOps,
  type PosterColor,
  type PosterOp,
  type PosterWeight,
} from './poster-layout';

/* The web poster uses the page font (Inter); load the bundled faces into Skia. */
const INTER_SOURCES = [Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold];

const WEIGHTS: Record<PosterWeight, FontWeight> = {
  400: FontWeight.Normal,
  500: FontWeight.Medium,
  600: FontWeight.SemiBold,
  700: FontWeight.Bold,
  800: FontWeight.ExtraBold,
};

let fontsPromise: Promise<SkTypefaceFontProvider> | null = null;

function loadPosterFonts(): Promise<SkTypefaceFontProvider> {
  if (!fontsPromise) {
    const pending = Promise.all(
      INTER_SOURCES.map(async (source) => {
        const uri = Image.resolveAssetSource(source)?.uri;
        if (!uri) throw new Error('Nie udało się wczytać fontu Inter.');
        const data = await Skia.Data.fromURI(uri);
        const typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
        if (!typeface) throw new Error('Nie udało się wczytać fontu Inter.');
        return typeface;
      }),
    ).then((typefaces) => {
      const provider = Skia.TypefaceFontProvider.Make();
      typefaces.forEach((typeface) => provider.registerFont(typeface, 'Inter'));
      return provider;
    });
    // A failed load must not stick: the dialog's retry tries again.
    pending.catch(() => {
      if (fontsPromise === pending) fontsPromise = null;
    });
    fontsPromise = pending;
  }
  return fontsPromise;
}

function posterPalette(colors: Colors): Record<PosterColor, string> {
  return {
    background: colors.background,
    card: colors.card,
    foreground: colors.foreground,
    muted: colors.mutedForeground,
    accent: colors.primary,
    border: colors.border,
  };
}

function paint(color: string, stroke?: { width: number; join?: StrokeJoin }) {
  const result = Skia.Paint();
  result.setAntiAlias(true);
  result.setColor(Skia.Color(color));
  if (stroke) {
    result.setStyle(PaintStyle.Stroke);
    result.setStrokeWidth(stroke.width);
    if (stroke.join !== undefined) result.setStrokeJoin(stroke.join);
  }
  return result;
}

function paragraph(fonts: SkTypefaceFontProvider, value: string, size: number, weight: PosterWeight, color: string): SkParagraph {
  const built = Skia.ParagraphBuilder.Make({ maxLines: 1 }, fonts)
    .pushStyle({ color: Skia.Color(color), fontFamilies: ['Inter'], fontSize: size, fontStyle: { weight: WEIGHTS[weight] } })
    .addText(value)
    .pop()
    .build();
  built.layout(100_000);
  return built;
}

/** Canvas `fillText(value, x, y, width)` after the web's shrink-to-fit loop. */
function drawText(canvas: SkCanvas, fonts: SkTypefaceFontProvider, op: Extract<PosterOp, { kind: 'text' }>, color: string) {
  let size = op.size;
  let text = paragraph(fonts, op.value, size, op.weight, color);
  while (text.getLongestLine() > op.width && size > 16) {
    text.dispose();
    size -= 1;
    text = paragraph(fonts, op.value, size, op.weight, color);
  }
  const measured = text.getLongestLine();
  const baseline = text.getLineMetrics()[0]?.baseline ?? size;
  canvas.save();
  canvas.translate(op.x, op.y);
  if (measured > op.width) canvas.scale(op.width / measured, 1);
  text.paint(canvas, 0, -baseline);
  canvas.restore();
  text.dispose();
}

function drawChart(canvas: SkCanvas, op: Extract<PosterOp, { kind: 'chart' }>, colors: Record<PosterColor, string>) {
  canvas.save();
  canvas.translate(84, 860);
  canvas.scale(0.91, 1.08);
  canvas.drawLine(24, op.zeroY, 976, op.zeroY, paint(colors.border, { width: 2 }));
  const builder = Skia.PathBuilder.Make();
  op.points.forEach((point, index) => {
    if (index === 0) builder.moveTo(point.x, point.y);
    else builder.lineTo(point.x, point.y);
  });
  canvas.drawPath(builder.build(), paint(colors.accent, { width: 5, join: StrokeJoin.Round }));
  canvas.restore();
}

/**
 * Renders the web's 1080 × 1920 Replay poster offscreen with Skia in the
 * current theme and returns it as base64 PNG.
 */
export async function createReplayPoster(model: ReplayModel, colors: Colors, name?: string): Promise<string> {
  const fonts = await loadPosterFonts();
  const surface = Skia.Surface.MakeOffscreen(POSTER_WIDTH, POSTER_HEIGHT) ?? Skia.Surface.Make(POSTER_WIDTH, POSTER_HEIGHT);
  if (!surface) throw new Error('To urządzenie nie obsługuje eksportu PNG.');
  const palette = posterPalette(colors);
  const canvas = surface.getCanvas();
  for (const op of replayPosterOps(model, name)) {
    if (op.kind === 'rect') canvas.drawRect(Skia.XYWHRect(op.x, op.y, op.width, op.height), paint(palette[op.color]));
    else if (op.kind === 'text') drawText(canvas, fonts, op, palette[op.color]);
    else if (op.kind === 'rule') canvas.drawLine(88, op.y, 992, op.y, paint(palette.border, { width: 2 }));
    else drawChart(canvas, op, palette);
  }
  surface.flush();
  const base64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.PNG, 100);
  surface.dispose();
  if (!base64) throw new Error('Nie udało się przygotować PNG. Spróbuj ponownie.');
  return base64;
}

/** Writes the poster to the cache directory as `bsplic-replay.png` for the share sheet. */
export async function writePosterFile(base64: string): Promise<File> {
  const file = new File(Paths.cache, 'bsplic-replay.png');
  file.create({ overwrite: true });
  await file.write(base64, { encoding: 'base64' });
  return file;
}

export function deletePosterFile() {
  try {
    const file = new File(Paths.cache, 'bsplic-replay.png');
    if (file.exists) file.delete();
  } catch {
    // The cache directory is purged by the OS anyway.
  }
}
