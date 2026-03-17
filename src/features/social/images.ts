import { supabase } from '@/integrations/supabase/client';

export const SOCIAL_IMAGES_BUCKET = 'social-images';
const MAX_IMAGE_DIMENSION = 1280;
const TARGET_IMAGE_BYTES = 200 * 1024;
const ABSOLUTE_MAX_IMAGE_BYTES = 280 * 1024;

interface LoadedImage {
  width: number;
  height: number;
  element: CanvasImageSource;
}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

function getScaledDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = width / height;
  if (ratio >= 1) {
    return {
      width: maxDimension,
      height: Math.round(maxDimension / ratio),
    };
  }

  return {
    width: Math.round(maxDimension * ratio),
    height: maxDimension,
  };
}

async function loadImage(file: File): Promise<LoadedImage> {
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      element: bitmap,
    };
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Nie udało się odczytać obrazu'));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Nie udało się wczytać obrazu'));
    img.src = dataUrl;
  });

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    element: image,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Nie udało się skompresować obrazu'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function compressImageFile(file: File): Promise<CompressedImage> {
  const loaded = await loadImage(file);
  let { width, height } = getScaledDimensions(
    loaded.width,
    loaded.height,
    MAX_IMAGE_DIMENSION,
  );

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Twoja przeglądarka nie obsługuje kompresji obrazu');
  }

  let bestBlob: Blob | null = null;
  let attempts = 0;

  while (attempts < 4) {
    attempts += 1;
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(loaded.element, 0, 0, width, height);

    const qualities = [0.8, 0.72, 0.64, 0.56, 0.48];
    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
      }
      if (blob.size <= TARGET_IMAGE_BYTES) {
        return { blob, width, height };
      }
    }

    width = Math.max(480, Math.round(width * 0.82));
    height = Math.max(480, Math.round(height * 0.82));
  }

  if (!bestBlob) {
    throw new Error('Nie udało się skompresować obrazu');
  }

  if (bestBlob.size > ABSOLUTE_MAX_IMAGE_BYTES) {
    throw new Error('Zdjęcie jest zbyt duże po kompresji. Spróbuj inne zdjęcie.');
  }

  return { blob: bestBlob, width, height };
}

export async function uploadSocialImage(userId: string, imageBlob: Blob): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

  const { error } = await supabase.storage
    .from(SOCIAL_IMAGES_BUCKET)
    .upload(path, imageBlob, {
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
