import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

/**
 * Social images (web `images.ts`): JPEG compression to about 85 KB, upload to
 * the `social-images` bucket and public URLs. The web compresses on a canvas;
 * here `expo-image-manipulator` runs the same size and quality steps.
 */

export const SOCIAL_IMAGES_BUCKET = 'social-images';

/** A compressed local JPEG ready for upload (the native stand-in for the web `Blob`). */
export interface SocialImageAttachment {
  uri: string;
  width: number;
  height: number;
  sizeBytes: number;
}

interface CompressImageOptions {
  maxDimension?: number;
  targetBytes?: number;
  absoluteMaxBytes?: number;
  minDimension?: number;
  maxAttempts?: number;
  qualities?: number[];
}

const DEFAULT_MAX_IMAGE_DIMENSION = 1280;
const DEFAULT_TARGET_IMAGE_BYTES = 85 * 1024;
/** The `social-images` bucket limit (90,000 bytes); the web's 90 KiB lets a 90.0–92.2 kB file through to a storage error. */
const DEFAULT_ABSOLUTE_MAX_IMAGE_BYTES = 90_000;
const DEFAULT_MIN_IMAGE_DIMENSION = 320;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_QUALITIES = [0.8, 0.72, 0.64, 0.56, 0.48];

export function getScaledDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const ratio = width / height;
  if (ratio >= 1) return { width: maxDimension, height: Math.round(maxDimension / ratio) };
  return { width: Math.round(maxDimension * ratio), height: maxDimension };
}

function deleteQuietly(uri: string) {
  try {
    new File(uri).delete();
  } catch {
    // Temporary manipulator output; the OS clears the cache directory anyway.
  }
}

/** Compresses a picked or pasted image (`sourceWidth`/`sourceHeight` from the picker). */
export async function compressSocialImage(
  sourceUri: string,
  sourceWidth: number,
  sourceHeight: number,
  options: CompressImageOptions = {},
): Promise<SocialImageAttachment> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_IMAGE_DIMENSION;
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_IMAGE_BYTES;
  const absoluteMaxBytes = options.absoluteMaxBytes ?? DEFAULT_ABSOLUTE_MAX_IMAGE_BYTES;
  const minDimension = options.minDimension ?? DEFAULT_MIN_IMAGE_DIMENSION;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const qualities = options.qualities ?? DEFAULT_QUALITIES;

  let { width, height } = getScaledDimensions(sourceWidth, sourceHeight, maxDimension);
  const minWidth = Math.min(width, minDimension);
  const minHeight = Math.min(height, minDimension);

  let best: SocialImageAttachment | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const image = await ImageManipulator.manipulate(sourceUri, { maxWidth: maxDimension, maxHeight: maxDimension })
      .resize({ width, height })
      .renderAsync();
    try {
      for (const quality of qualities) {
        const result = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
        const sizeBytes = new File(result.uri).size ?? Number.POSITIVE_INFINITY;
        const candidate = { uri: result.uri, width: result.width, height: result.height, sizeBytes };
        if (!best || sizeBytes < best.sizeBytes) {
          if (best) deleteQuietly(best.uri);
          best = candidate;
        } else {
          deleteQuietly(result.uri);
        }
        if (sizeBytes <= targetBytes) return candidate;
      }
    } finally {
      image.release();
    }

    width = Math.max(minWidth, Math.round(width * 0.82));
    height = Math.max(minHeight, Math.round(height * 0.82));
  }

  if (!best) throw new Error('Nie udało się skompresować obrazu');
  if (best.sizeBytes > absoluteMaxBytes) {
    deleteQuietly(best.uri);
    throw new Error('Zdjęcie jest zbyt duże po kompresji. Spróbuj inne zdjęcie.');
  }
  return best;
}

/** Uploads a compressed image and returns its storage path (`<userId>/<time>-<rand6>.jpg`). */
export async function uploadSocialImage(userId: string, image: SocialImageAttachment): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const body = await new File(image.uri).arrayBuffer();

  const { error } = await supabase.storage.from(SOCIAL_IMAGES_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '31536000',
  });

  if (error) throw new Error(error.message);
  return path;
}

export function getSocialImageUrl(path: string): string {
  const { data } = supabase.storage.from(SOCIAL_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
