import { fetch } from 'expo/fetch';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/integrations/supabase/client';

export const SOCIAL_IMAGES_BUCKET = 'social-images';
const TARGET_BYTES = 85 * 1024;
const ABSOLUTE_MAX_BYTES = 90 * 1024;
const MAX_DIMENSION = 1280;
const MIN_DIMENSION = 320;
const QUALITIES = [0.8, 0.7, 0.6, 0.5, 0.42];

export interface PreparedSocialImage {
  uri: string;
  width: number;
  height: number;
  bytes: number;
}

async function prepareAsset(asset: ImagePicker.ImagePickerAsset): Promise<PreparedSocialImage> {
  let width = asset.width;
  let height = asset.height;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  let best: PreparedSocialImage | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    for (const compress of QUALITIES) {
      const result = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width, height } }],
        { compress, format: ImageManipulator.SaveFormat.JPEG },
      );
      const response = await fetch(result.uri);
      const bytes = response.headers.get('content-length');
      const measuredBytes = bytes ? Number(bytes) : (await response.arrayBuffer()).byteLength;
      const candidate = { uri: result.uri, width: result.width, height: result.height, bytes: measuredBytes };
      if (!best || candidate.bytes < best.bytes) best = candidate;
      if (candidate.bytes <= TARGET_BYTES) return candidate;
    }
    if (Math.max(width, height) <= MIN_DIMENSION) break;
    width = Math.max(MIN_DIMENSION, Math.round(width * 0.82));
    height = Math.max(MIN_DIMENSION, Math.round(height * 0.82));
  }

  if (!best || best.bytes > ABSOLUTE_MAX_BYTES) {
    throw new Error('Zdjęcie jest zbyt duże po kompresji. Wybierz inne zdjęcie.');
  }
  return best;
}

export async function pickSocialImage(source: 'camera' | 'library'): Promise<PreparedSocialImage | null> {
  const permission = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(source === 'camera' ? 'Zezwól aplikacji na dostęp do aparatu.' : 'Zezwól aplikacji na dostęp do zdjęć.');
  }

  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1, selectionLimit: 1 });
  if (result.canceled || !result.assets[0]) return null;
  return prepareAsset(result.assets[0]);
}

export async function uploadSocialImage(userId: string, image: PreparedSocialImage): Promise<string> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const body = await (await fetch(image.uri)).arrayBuffer();
  if (body.byteLength > ABSOLUTE_MAX_BYTES) throw new Error('Zdjęcie przekracza limit 90 KB.');
  const { error } = await supabase.storage.from(SOCIAL_IMAGES_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export function getSocialImageUrl(path: string): string {
  return supabase.storage.from(SOCIAL_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}
