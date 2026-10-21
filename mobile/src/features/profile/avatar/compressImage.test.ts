import { describe, expect, it } from 'vitest';

import { compressImage, getScaledDimensions } from './compressImage';

const AVATAR = { maxDimension: 640, targetBytes: 135 * 1024, absoluteMaxBytes: 140 * 1024, minDimension: 256 };

/** Encoder whose output size comes from a fixed table, recording every call. */
function tableEncoder(sizeFor: (width: number, height: number, quality: number) => number) {
  const calls: { width: number; height: number; quality: number }[] = [];
  const encode = async (width: number, height: number, quality: number) => {
    calls.push({ width, height, quality });
    return { size: sizeFor(width, height, quality), value: `${width}x${height}@${quality}` };
  };
  return { calls, encode };
}

describe('getScaledDimensions', () => {
  it('fits landscape and portrait images inside the max dimension, keeping the ratio', () => {
    expect(getScaledDimensions(4032, 3024, 640)).toEqual({ width: 640, height: 480 });
    expect(getScaledDimensions(3024, 4032, 640)).toEqual({ width: 480, height: 640 });
  });

  it('keeps images that already fit', () => {
    expect(getScaledDimensions(500, 300, 640)).toEqual({ width: 500, height: 300 });
  });
});

describe('compressImage', () => {
  it('returns the first encoding at or under the target size', async () => {
    const { calls, encode } = tableEncoder((_w, _h, quality) => (quality >= 0.72 ? 200_000 : 120_000));

    const result = await compressImage({ width: 1280, height: 960 }, encode, AVATAR);

    expect(result).toMatchObject({ value: '640x480@0.64', size: 120_000, width: 640, height: 480 });
    expect(calls.map((call) => call.quality)).toEqual([0.8, 0.72, 0.64]);
  });

  it('shrinks by 18% per attempt but never below the minimum dimension', async () => {
    const { calls, encode } = tableEncoder(() => 500_000);

    await expect(compressImage({ width: 400, height: 320 }, encode, AVATAR)).rejects.toThrow(
      'Zdjęcie jest zbyt duże po kompresji. Spróbuj inne zdjęcie.',
    );

    const sizes = [...new Set(calls.map((call) => `${call.width}x${call.height}`))];
    expect(sizes).toEqual(['400x320', '328x262', '269x256', '256x256']);
    expect(calls).toHaveLength(25);
  });

  it('falls back to the smallest encoding when it fits the absolute maximum', async () => {
    // Never reaches the 135 KiB target; the smallest result is 140 KiB exactly.
    const { encode } = tableEncoder((width, _h, quality) => (width < 300 && quality === 0.48 ? 140 * 1024 : 150_000));
    const discarded: string[] = [];

    const result = await compressImage({ width: 640, height: 640 }, encode, AVATAR, (value) => discarded.push(value));

    expect(result).toMatchObject({ value: '289x289@0.48', size: 140 * 1024 });
    expect(discarded).not.toContain('289x289@0.48');
    expect(discarded).toHaveLength(24);
  });
});
