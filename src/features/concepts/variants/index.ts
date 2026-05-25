import type { ConceptVariantDefinition } from '../types';
import { Variant1NeonGrid } from './variant-1-neon-grid';
import { Variant2GlassDeck } from './variant-2-glass-deck';
import { Variant3BrutalistLedger } from './variant-3-brutalist-ledger';
import { Variant4EditorialFeed } from './variant-4-editorial-feed';
import { Variant5AuroraBoost } from './variant-5-aurora-boost';
import { Variant6CompactTicker } from './variant-6-compact-ticker';
import { Variant7CardCarousel } from './variant-7-card-carousel';
import { Variant8SplitPane } from './variant-8-split-pane';

export const conceptVariantDefinitions: ConceptVariantDefinition[] = [
  {
    id: 1,
    slug: 'neon-grid',
    label: 'Neon Grid',
    description: 'Gęsta tabela kursów w stylu terminala — cyjan zamiast żółci, siatka zamiast kart.',
    component: Variant1NeonGrid,
  },
  {
    id: 2,
    slug: 'glass-deck',
    label: 'Glass Deck',
    description: 'Betclic-like hero zdjęcia z matowymi panelami szkła, żółte CTA i chipy kategorii.',
    component: Variant2GlassDeck,
  },
  {
    id: 3,
    slug: 'brutalist-ledger',
    label: 'Brutalist Ledger',
    description: 'Zero zaokrągleń, grube obramowania, mono kursy — surowy dziennik zakładów.',
    component: Variant3BrutalistLedger,
  },
  {
    id: 4,
    slug: 'editorial-feed',
    label: 'Editorial Feed',
    description: 'Magazyn sportowy: duża typografia serif, zdjęcia full-bleed, subtelne kursy.',
    component: Variant4EditorialFeed,
  },
  {
    id: 5,
    slug: 'aurora-boost',
    label: 'Aurora Boost',
    description: 'Gradienty fuchsia/violet, świecąca karta boost z countdownem jak esport promo.',
    component: Variant5AuroraBoost,
  },
  {
    id: 6,
    slug: 'compact-ticker',
    label: 'Compact Ticker',
    description: 'Gęsty feed w stylu giełdy — taśma live u góry, lime akcent, trend strzałki.',
    component: Variant6CompactTicker,
  },
  {
    id: 7,
    slug: 'card-carousel',
    label: 'Card Carousel',
    description: 'Jeden mecz na ekran, pełnoekranowa karta ze strzałkami — focus na wyborze.',
    component: Variant7CardCarousel,
  },
  {
    id: 8,
    slug: 'split-pane',
    label: 'Split Pane',
    description: 'Sticky kolumna Live po lewej, przewijany feed meczów i strzelców po prawej.',
    component: Variant8SplitPane,
  },
];
