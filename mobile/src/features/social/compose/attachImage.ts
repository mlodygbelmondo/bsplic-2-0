import * as ImagePicker from 'expo-image-picker';

import { haptics } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { getErrorMessage } from '@/lib/errors';
import { compressSocialImage, type SocialImageAttachment } from '../images';

/** Social text limit (web `MAX_LENGTH` / `maxLength={500}`, UTF-16 units like the web). */
export const SOCIAL_TEXT_MAX_LENGTH = 500;

function isImageAsset(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) return asset.mimeType.startsWith('image/');
  return asset.type === 'image';
}

interface AttachImageOptions {
  /** The image already attached; a second one is refused with `tooManyMessage`. */
  current: SocialImageAttachment | null;
  tooManyMessage: string;
  /** Posts and comments toast after compressing; stories do not. */
  announceSuccess: boolean;
}

/**
 * Photo library pick + web compression (the web attaches by pasting; native
 * uses the picker). Resolves the compressed image, or null when cancelled or
 * refused. Toasts use the web copy.
 */
export async function attachSocialImage({
  current,
  tooManyMessage,
  announceSuccess,
}: AttachImageOptions): Promise<SocialImageAttachment | null> {
  if (current) {
    toast.error(tooManyMessage);
    return null;
  }

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    if (!isImageAsset(asset) || asset.width <= 0 || asset.height <= 0) {
      throw new Error('Nie udało się odczytać obrazu');
    }

    const image = await compressSocialImage(asset.uri, asset.width, asset.height);
    if (announceSuccess) toast.success('Zdjęcie zostało dodane i skompresowane');
    return image;
  } catch (error) {
    haptics.error();
    toast.error(getErrorMessage(error, 'Nie udało się dodać zdjęcia'));
    return null;
  }
}
