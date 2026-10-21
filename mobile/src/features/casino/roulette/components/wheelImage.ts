import { Skia, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image } from 'react-native';

import { casinoImages } from '../../shared/casinoImages';

/**
 * The wheel artwork decoded once for Skia and kept for the session, so
 * reopening the table (or pressing its hub tile, which prewarms it) never
 * shows an empty wheel while the WebP decodes.
 */
let wheelImage: SkImage | null = null;
let pending: Promise<SkImage | null> | null = null;

export function loadRouletteWheelImage(): Promise<SkImage | null> {
  if (wheelImage) return Promise.resolve(wheelImage);
  const uri = Image.resolveAssetSource(casinoImages.rouletteWheel)?.uri;
  if (!uri) return Promise.resolve(null);
  pending ??= Skia.Data.fromURI(uri)
    .then((data) => {
      wheelImage = Skia.Image.MakeImageFromEncoded(data);
      return wheelImage;
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

export function useRouletteWheelImage(): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(wheelImage);

  useEffect(() => {
    if (image) return;
    let mounted = true;
    void loadRouletteWheelImage().then((loaded) => {
      if (mounted && loaded) setImage(loaded);
    });
    return () => {
      mounted = false;
    };
  }, [image]);

  return image;
}
