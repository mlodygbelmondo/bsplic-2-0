import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alpha, createStyles } from '@/theme';
import { SheetHeader, Text } from '@/ui';
import { isSlotGame, paytableMultiplier, SLOT_GAMES, type SlotGame } from './model';
import { SlotSymbol } from './SlotSymbol';

const BODY_PADDING = 20;
const GRID_GAP = 8;
const PAYING_SYMBOLS = Array.from({ length: 7 }, (_, symbol) => symbol);

/** `sheets/slot-rules?game=…` (web `SlotRules` dialog): rules, bonus, lucky shot and paytable. */
export function SlotRulesSheet({ game }: { game: string | undefined }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  if (!isSlotGame(game)) {
    return (
      <View style={styles.sheet}>
        <SheetHeader title="Zasady i wypłaty" />
        <View style={styles.body}>
          <Text style={styles.paragraph}>Nie ma takiej gry.</Text>
        </View>
      </View>
    );
  }
  const config = SLOT_GAMES[game];
  return (
    <View style={styles.sheet} collapsable={false}>
      <SheetHeader title={`${config.title} · zasady`} description={`${config.rule}.`} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
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
      </ScrollView>
    </View>
  );
}

function Paytable({ game }: { game: SlotGame }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 2 * BODY_PADDING - 2 * GRID_GAP) / 3;
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

const useStyles = createStyles(({ colors }) => ({
  sheet: { flex: 1, backgroundColor: colors.background },
  body: { paddingHorizontal: BODY_PADDING, gap: 16 },
  // Tailwind `text-sm leading-relaxed`.
  paragraph: { fontSize: 14, lineHeight: 22.75 },
  strong: { fontWeight: '700' },
  lucky: { borderRadius: 12, padding: 12, backgroundColor: alpha('#f59e0b', 0.1) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  tile: { alignItems: 'center', borderRadius: 12, padding: 8, backgroundColor: 'rgba(0, 0, 0, 0.8)' },
  tileValue: { color: '#ffffff', textAlign: 'center' },
}));
