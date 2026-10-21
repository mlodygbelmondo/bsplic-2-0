import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { alpha, createStyles, useTheme } from '@/theme';
import { OverlayScreen, Text, useOverlayClose } from '@/ui';
import { isSlotGame, paytableMultiplier, SLOT_GAMES, type SlotGame } from './model';
import { SlotSymbol } from './SlotSymbol';

// shadcn DialogContent defaults: `w-[calc(100%-2rem)] max-w-lg p-6 border`.
const DIALOG_MAX_WIDTH = 512;
const DIALOG_PADDING = 24;
const DIALOG_BORDER = 1;
const GRID_GAP = 8;
const PAYING_SYMBOLS = Array.from({ length: 7 }, (_, symbol) => symbol);

/** `sheets/slot-rules?game=…` (web `SlotRules` dialog): rules, bonus, lucky shot and paytable. */
export function SlotRulesSheet({ game }: { game: string | undefined }) {
  const styles = useStyles();
  if (!isSlotGame(game)) {
    return (
      <RulesDialog title="Zasady i wypłaty">
        <Text style={styles.paragraph}>Nie ma takiej gry.</Text>
      </RulesDialog>
    );
  }
  const config = SLOT_GAMES[game];
  return (
    <RulesDialog title={`${config.title} · zasady`} description={`${config.rule}.`}>
      <View style={styles.body}>
        <Text style={styles.paragraph}>
          Ustaw stawkę i naciśnij „Zakręć”. Plansza ma 6 kolumn i 5 rzędów. Wypłaty ze wszystkich kaskad sumują się w
          jednym obrocie.
        </Text>
        <Text style={styles.paragraph}>
          Wygrywające symbole znikają, a na ich miejsce spadają nowe. Jeden obrót obejmuje maksymalnie 12 układów. Łączna
          wypłata jest ograniczona do 200× stawki.
        </Text>
        <Text style={styles.paragraph}>{config.multiplierRule}</Text>
        <Text style={styles.paragraph}>
          4 lub więcej symboli BONUS na pierwszej planszy płatnego obrotu daje 15 darmowych obrotów z tą samą stawką.
          Każda darmowa kaskada płaci 75% zwykłej wypłaty, po zaokrągleniu do 0,01. Bonus rozgrywa się automatycznie, a
          przycisk pauzy zatrzymuje go przed następnym obrotem. Po zakończeniu bonusu gra czeka na Twoje kliknięcie. Limit
          wypłaty wynosi 200× stawki na obrót. Darmowe obroty nie przyznają kolejnych bonusów. Niewykorzystane obroty
          zostają na koncie.
        </Text>
        <View style={styles.lucky}>
          <Text style={[styles.paragraph, styles.strong]}>Lucky shot</Text>
          <Text style={styles.paragraph}>
            Pierwszy płatny obrót po co najmniej 6 godzinach bez płatnej gry we wszystkich slotach ma 1% szans na lucky
            shot. Trafienie daje łączną wypłatę ×200 stawki, zamiast zwykłej wypłaty z planszy. Kolejne obroty i darmowe
            obroty nie biorą udziału w tym losowaniu.
          </Text>
        </View>
        <Text style={styles.paragraph}>
          Każde pole losuje BONUS z szansą 2,5%. Każdy z pozostałych 7 symboli ma szansę 97,5% ÷ 7. Poniżej wypłata za
          minimalną grupę przed mnożnikiem.
        </Text>
        <Paytable game={game} />
        <Text style={styles.paragraph}>
          Każdy dodatkowy symbol w grupie mnoży jej bazową wypłatę przez 1,35. Bazowa wypłata jest zaokrąglana do 0,01
          przed mnożnikiem. Wynik netto = wypłata − pobrana stawka.
        </Text>
      </View>
    </RulesDialog>
  );
}

/**
 * Web `DialogContent className="max-h-[85dvh] overflow-y-auto"`: the whole card scrolls, including the
 * header and the absolute close X (`right-4 top-4`).
 */
function RulesDialog({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const close = useOverlayClose();
  return (
    <OverlayScreen
      variant="dialog"
      accessibilityLabel={title}
      style={[styles.card, { width: width - 32, maxHeight: height * 0.85 }]}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text size="lg" weight="600" align="center" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {description ? (
            <Text color="mutedForeground" align="center">
              {description}
            </Text>
          ) : null}
        </View>
        {children}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
          hitSlop={14}
          onPress={() => close()}
          style={styles.close}
        >
          <X size={16} color={colors.foreground} />
        </Pressable>
      </ScrollView>
    </OverlayScreen>
  );
}

function Paytable({ game }: { game: SlotGame }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - 32, DIALOG_MAX_WIDTH) - 2 * (DIALOG_PADDING + DIALOG_BORDER);
  // `grid grid-cols-3 gap-2` (phone width).
  const tileWidth = (contentWidth - 2 * GRID_GAP) / 3;
  return (
    <View style={styles.grid}>
      {PAYING_SYMBOLS.map((symbol) => (
        <View key={symbol} style={[styles.tile, { width: tileWidth }]}>
          <SlotSymbol game={game} symbol={symbol} size={48} />
          <Text size="xs" tabular style={styles.tileValue}>
            {paytableMultiplier(game, symbol)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles(() => ({
  card: { maxWidth: DIALOG_MAX_WIDTH, borderRadius: 8 },
  scroll: { flexGrow: 0 },
  // `p-6` plus the `grid gap-4` between the header and the rules block.
  content: { padding: DIALOG_PADDING, gap: 16 },
  // DialogHeader `flex flex-col space-y-1.5 text-center` (phone width).
  header: { gap: 6 },
  // DialogTitle `text-lg font-semibold leading-none tracking-tight`.
  title: { lineHeight: 18, letterSpacing: -0.45 },
  // `absolute right-4 top-4 opacity-70`, 16px X; no background (see WORKER-BRIEF).
  close: { position: 'absolute', right: 16, top: 16, opacity: 0.7 },
  // `space-y-4 text-sm leading-relaxed`.
  body: { gap: 16 },
  // Tailwind `text-sm leading-relaxed`.
  paragraph: { fontSize: 14, lineHeight: 22.75 },
  strong: { fontWeight: '700' },
  lucky: { borderRadius: 12, padding: 12, backgroundColor: alpha('#f59e0b', 0.1) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: { alignItems: 'center', borderRadius: 12, padding: 8, backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  tileValue: { color: '#ffffff', textAlign: 'center' },
}));
