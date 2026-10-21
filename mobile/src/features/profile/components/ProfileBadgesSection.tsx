import { Canvas, ColorMatrix, Image as SkiaImage, useImage } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { memo } from 'react';
import { View } from 'react-native';

import { alpha, createStyles } from '@/theme';
import { BADGE_DEFINITIONS, type Badge } from '@/types/database';
import { Text } from '@/ui';
import { formatBadgeDate } from '../logic/format';
import { BADGE_IMAGES } from './badgeImages';
import { useSurfaceStyles } from './surfaces';

/** CSS `grayscale(1)` as a color matrix (luminance weights from the Filter Effects spec). */
const GRAYSCALE = [
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0.2126, 0.7152, 0.0722, 0, 0,
  0, 0, 0, 1, 0,
];
const IMAGE_SIZE = 56;
const BADGE_ENTRIES = Object.entries(BADGE_DEFINITIONS);

/** The full badge catalog (15), locked and unlocked, like the web `ProfileBadgesSection`. */
export function ProfileBadgesSection({ badges }: { badges: Badge[] }) {
  const surfaces = useSurfaceStyles();
  const styles = useStyles();
  return (
    <View role="region" accessibilityLabel="Odznaki" style={[surfaces.card, styles.section]}>
      <Text size="base" weight="700" accessibilityRole="header" style={styles.heading}>
        Odznaki
      </Text>
      <View role="list" style={styles.list}>
        {BADGE_ENTRIES.map(([key, definition]) => (
          <BadgeItem
            key={key}
            badgeKey={key}
            name={definition.name}
            description={definition.description}
            unlockedAt={badges.find((badge) => badge.badge_key === key)?.unlocked_at ?? null}
          />
        ))}
      </View>
    </View>
  );
}

const BadgeItem = memo(function BadgeItem({
  badgeKey,
  name,
  description,
  unlockedAt,
}: {
  badgeKey: string;
  name: string;
  description: string;
  unlockedAt: string | null;
}) {
  const surfaces = useSurfaceStyles();
  const styles = useStyles();
  const unlocked = unlockedAt !== null;
  const status = unlocked ? `Odblokowano: ${formatBadgeDate(unlockedAt)}` : 'Nieodblokowana';

  return (
    <View
      role="listitem"
      accessible
      accessibilityLabel={`${name}. ${description}. ${status}`}
      style={[styles.item, surfaces.sub, unlocked && styles.itemUnlocked]}
    >
      <View style={styles.row}>
        <View style={[styles.iconBox, unlocked ? styles.iconBoxUnlocked : styles.iconBoxLocked]}>
          {unlocked ? (
            <Image
              source={BADGE_IMAGES[badgeKey]}
              accessibilityLabel={`Odznaka ${name}`}
              style={styles.image}
              contentFit="contain"
            />
          ) : (
            <LockedBadgeImage badgeKey={badgeKey} />
          )}
        </View>
        <View style={styles.textColumn}>
          <Text weight="600" style={styles.name}>
            {name}
          </Text>
          <Text size="xs" color="mutedForeground" style={styles.description}>
            {description}
          </Text>
          <Text size="xs" weight="500" color={unlocked ? 'primary' : 'mutedForeground'} style={styles.status}>
            {status}
          </Text>
        </View>
      </View>
    </View>
  );
});

/** `grayscale opacity-60` (iOS views have no grayscale filter, so Skia draws it). */
function LockedBadgeImage({ badgeKey }: { badgeKey: string }) {
  const styles = useStyles();
  const image = useImage(BADGE_IMAGES[badgeKey]);
  return (
    <Canvas style={[styles.image, styles.locked]}>
      {image ? (
        <SkiaImage image={image} x={0} y={0} width={IMAGE_SIZE} height={IMAGE_SIZE} fit="contain">
          <ColorMatrix matrix={GRAYSCALE} />
        </SkiaImage>
      ) : null}
    </Canvas>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  section: { padding: 16 },
  heading: { marginBottom: 12 },
  list: { gap: 12 },
  item: { borderRadius: 12, borderCurve: 'continuous', padding: 12 },
  // ring-1 ring-primary/25
  itemUnlocked: { boxShadow: `0px 0px 0px 1px ${alpha(colors.primary, 0.25)}` },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconBox: {
    width: 64,
    height: 64,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  iconBoxUnlocked: { borderColor: alpha(colors.primary, 0.2), backgroundColor: colors.background },
  iconBoxLocked: { borderColor: colors.border, backgroundColor: alpha(colors.muted, 0.4) },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE },
  locked: { opacity: 0.6 },
  textColumn: { flex: 1, minWidth: 0 },
  // text-sm font-semibold leading-tight
  name: { lineHeight: 17.5 },
  // mt-1 text-xs leading-relaxed
  description: { marginTop: 4, lineHeight: 19.5 },
  status: { marginTop: 8 },
}));
