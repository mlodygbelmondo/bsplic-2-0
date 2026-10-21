import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

import { authActions } from '@/features/auth/auth-store';
import { OFFLINE_WRITE_MESSAGE } from '@/lib/connectivity';
import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { uploadAvatar } from './uploadAvatar';

const FALLBACK_ERROR = 'Nie udało się zaktualizować zdjęcia profilowego';

function isImageAsset(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType.startsWith('image/');
  return asset.type === 'image';
}

/**
 * Own-profile avatar change (web `handleAvatarChange`): photo library picker,
 * compression to the web limits, upload, profile update, profile refresh.
 * `overrideUrl` shows the new avatar right away, like the web.
 */
export function useAvatarUpload(userId: string | null, offline: boolean) {
  const [uploading, setUploading] = useState(false);
  const [overrideUrl, setOverrideUrl] = useState<string | null>(null);

  const pickAndUpload = async () => {
    if (!userId || uploading) return;
    if (offline) {
      toast.error(OFFLINE_WRITE_MESSAGE);
      return;
    }

    let asset: ImagePicker.ImagePickerAsset | undefined;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (result.canceled) return;
      asset = result.assets[0];
    } catch (error) {
      toast.error(error instanceof Error ? error.message : FALLBACK_ERROR);
      return;
    }
    if (!asset) return;

    if (!isImageAsset(asset)) {
      toast.error('Wybierz plik obrazu');
      return;
    }

    setUploading(true);
    try {
      const avatarUrl = await uploadAvatar(userId, asset.uri);
      setOverrideUrl(avatarUrl);
      await authActions.refreshProfile();
      haptics.success();
      toast.success('Zdjęcie profilowe zaktualizowane');
    } catch (error) {
      haptics.error();
      toast.error(error instanceof Error ? error.message : FALLBACK_ERROR);
    } finally {
      setUploading(false);
    }
  };

  return { uploading, overrideUrl, pickAndUpload };
}
