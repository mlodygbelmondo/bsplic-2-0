import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react-native';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { haptics } from '@/lib/haptics';
import { createStyles, useTheme } from '@/theme';
import { PressScale, Text } from '@/ui';
import { getPaginationRange } from './filters';

/**
 * Web `PaginationBar` at phone width: chevrons only (`Wstecz`/`Dalej` are
 * `hidden sm:inline`), the active page as an outline button, the rest ghost.
 */
export function PaginationBar({
  currentPage,
  totalPages,
  onPageChange,
  style,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const pages = getPaginationRange(currentPage, totalPages);
  const atStart = currentPage === 0;
  const atEnd = currentPage >= totalPages - 1;

  const go = (page: number) => {
    haptics.selection();
    onPageChange(page);
  };

  return (
    <View accessibilityLabel="Nawigacja po stronach" style={[styles.bar, style]}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Poprzednia strona"
        hitSlop={2}
        accessibilityState={{ disabled: atStart }}
        disabled={atStart}
        onPress={() => go(Math.max(0, currentPage - 1))}
        style={[styles.step, atStart && styles.disabled]}
      >
        <ChevronLeft size={16} color={colors.foreground} />
      </PressScale>

      {pages.map((page, index) =>
        page === 'ellipsis' ? (
          // Two ellipses can never sit next to each other, so the index keys are stable.
          <View key={`e-${index}`} style={styles.ellipsis} accessibilityElementsHidden>
            <MoreHorizontal size={16} color={colors.foreground} />
          </View>
        ) : (
          <PressScale
            key={page}
            accessibilityRole="button"
            accessibilityLabel={`Strona ${page + 1}`}
            hitSlop={2}
            accessibilityState={{ selected: page === currentPage }}
            onPress={() => go(page)}
            style={[styles.page, page === currentPage && styles.activePage]}
          >
            <Text weight="500">{page + 1}</Text>
          </PressScale>
        ),
      )}

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Następna strona"
        hitSlop={2}
        accessibilityState={{ disabled: atEnd }}
        disabled={atEnd}
        onPress={() => go(Math.min(totalPages - 1, currentPage + 1))}
        style={[styles.step, atEnd && styles.disabled]}
      >
        <ChevronRight size={16} color={colors.foreground} />
      </PressScale>
    </View>
  );
}

const useStyles = createStyles(({ colors, radius }) => ({
  bar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 },
  step: {
    height: 40,
    minWidth: 44,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  page: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activePage: { borderColor: colors.input, backgroundColor: colors.background },
  ellipsis: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
}));
