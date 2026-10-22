import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat, type ImageRef } from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';
import { COMPRESSION_FAILED, compressImage } from './compressImage';

export const PROFILE_AVATARS_BUCKET = 'profile-avatars';

/** Web limits passed to `compressImageFile` for avatars; the hard cap is the bucket's 140 000 B limit. */
const AVATAR_COMPRESSION = {
  maxDimension: 640,
  targetBytes: 135 * 1024,
  absoluteMaxBytes: 140_000,
  minDimension: 256,
} as const;

const IMAGE_READ_FAILED = 'Nie udało się wczytać obrazu';

function deleteQuietly(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Temporary cache file; the OS cleans it up eventually.
  }
}

/** Decodes, resizes and re-encodes the picked image as a JPEG within the avatar limits. */
async function compressAvatar(sourceUri: string): Promise<string> {
  let base: ImageRef;
  try {
    // Downsample while decoding so a 48 MP photo never lands in memory at full size.
    base = await ImageManipulator.manipulate(sourceUri, {
      maxWidth: AVATAR_COMPRESSION.maxDimension,
      maxHeight: AVATAR_COMPRESSION.maxDimension,
    }).renderAsync();
  } catch {
    throw new Error(IMAGE_READ_FAILED);
  }

  const rendered = new Map<string, ImageRef>([[`${base.width}x${base.height}`, base]]);
  const renderAt = async (width: number, height: number) => {
    const key = `${width}x${height}`;
    const existing = rendered.get(key);
    if (existing) return existing;
    const next = await ImageManipulator.manipulate(base).resize({ width, height }).renderAsync();
    rendered.set(key, next);
    return next;
  };

  try {
    const result = await compressImage(
      { width: base.width, height: base.height },
      async (width, height, quality) => {
        try {
          const image = await renderAt(width, height);
          const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
          return { size: new File(saved.uri).size, value: saved.uri };
        } catch {
          throw new Error(COMPRESSION_FAILED);
        }
      },
      AVATAR_COMPRESSION,
      deleteQuietly,
    );
    return result.value;
  } finally {
    rendered.forEach((image) => image.release());
  }
}

/**
 * Web `handleAvatarChange` pipeline after validation: compress, upload to
 * `profile-avatars/<userId>/<ms>-<rand6>.jpg`, then point `profiles.avatar_url`
 * at the public URL. Returns that URL. Errors carry the web's messages (raw
 * Supabase text for storage and profile errors).
 */
export async function uploadAvatar(userId: string, sourceUri: string): Promise<string> {
  const jpegUri = await compressAvatar(sourceUri);

  try {
    const bytes = await new File(jpegUri).arrayBuffer();
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error: uploadError } = await supabase.storage.from(PROFILE_AVATARS_BUCKET).upload(path, bytes, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    });
    if (uploadError) throw new Error(uploadError.message);

    const { data: publicUrlData } = supabase.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;

    const { error: profileError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
    if (profileError) throw new Error(profileError.message);

    return avatarUrl;
  } finally {
    deleteQuietly(jpegUri);
  }
}
