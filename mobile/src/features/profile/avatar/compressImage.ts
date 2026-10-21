/**
 * Port of the web `compressImageFile` loop (`src/features/social/images.ts`):
 * encode JPEG at falling qualities, shrink by 18% per attempt down to a
 * minimum dimension, return the first result under the target size, else the
 * smallest one if it fits the absolute maximum. Encoding is injected so the
 * native adapter (expo-image-manipulator) stays out of this pure loop.
 */

export interface CompressImageOptions {
  maxDimension?: number;
  targetBytes?: number;
  absoluteMaxBytes?: number;
  minDimension?: number;
  maxAttempts?: number;
  qualities?: number[];
}

export interface EncodedImage<T> {
  size: number;
  value: T;
}

export interface CompressedImage<T> {
  value: T;
  size: number;
  width: number;
  height: number;
}

/** Encodes the source at `width`×`height` with JPEG `quality` (0–1). */
export type ImageEncoder<T> = (width: number, height: number, quality: number) => Promise<EncodedImage<T>>;

const DEFAULT_MAX_IMAGE_DIMENSION = 1280;
const DEFAULT_TARGET_IMAGE_BYTES = 85 * 1024;
const DEFAULT_ABSOLUTE_MAX_IMAGE_BYTES = 90 * 1024;
const DEFAULT_MIN_IMAGE_DIMENSION = 320;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_QUALITIES = [0.8, 0.72, 0.64, 0.56, 0.48];

export const TOO_LARGE_AFTER_COMPRESSION = 'Zdjęcie jest zbyt duże po kompresji. Spróbuj inne zdjęcie.';
export const COMPRESSION_FAILED = 'Nie udało się skompresować obrazu';

export function getScaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = width / height;
  if (ratio >= 1) {
    return { width: maxDimension, height: Math.round(maxDimension / ratio) };
  }

  return { width: Math.round(maxDimension * ratio), height: maxDimension };
}

/**
 * `discard` is called for every encoded result that is not returned, so the
 * native adapter can delete its temporary files.
 */
export async function compressImage<T>(
  source: { width: number; height: number },
  encode: ImageEncoder<T>,
  options: CompressImageOptions = {},
  discard: (value: T) => void = () => undefined,
): Promise<CompressedImage<T>> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION;
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_IMAGE_BYTES;
  const absoluteMaxBytes = options.absoluteMaxBytes ?? DEFAULT_ABSOLUTE_MAX_IMAGE_BYTES;
  const minDimension = options.minDimension ?? DEFAULT_MIN_IMAGE_DIMENSION;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const qualities = options.qualities ?? DEFAULT_QUALITIES;

  let { width, height } = getScaledDimensions(source.width, source.height, maxDimension);
  const minWidth = Math.min(width, minDimension);
  const minHeight = Math.min(height, minDimension);

  let best: CompressedImage<T> | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;

    for (const quality of qualities) {
      const encoded = await encode(width, height, quality);
      if (encoded.size <= targetBytes) {
        if (best) discard(best.value);
        return { value: encoded.value, size: encoded.size, width, height };
      }
      if (!best || encoded.size < best.size) {
        if (best) discard(best.value);
        best = { value: encoded.value, size: encoded.size, width, height };
      } else {
        discard(encoded.value);
      }
    }

    width = Math.max(minWidth, Math.round(width * 0.82));
    height = Math.max(minHeight, Math.round(height * 0.82));
  }

  if (!best) {
    throw new Error(COMPRESSION_FAILED);
  }

  if (best.size > absoluteMaxBytes) {
    discard(best.value);
    throw new Error(TOO_LARGE_AFTER_COMPRESSION);
  }

  return best;
}
