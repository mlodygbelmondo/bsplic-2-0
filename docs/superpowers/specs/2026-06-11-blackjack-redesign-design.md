# Blackjack 2.0 — redesign, feeling i grywalne asy

Data: 2026-06-11 • Status: zatwierdzony przez Piotra

## Kontekst

Blackjack odstaje wizualnie i "feelingowo" od reszty appki: karty pojawiają się
płaskim fade-inem, krupier wykłada wszystkie karty naraz po Stand (zero
napięcia), split na mobile to poziomy scroll dużych boxów. Dodatkowo zgłoszenie
od gracza: po splicie asów gra "sama się kończy" — to standardowa zasada
kasynowa (jedna karta na asa + auto-stand), ale decyzja produktowa: u nas po
splicie asów ma się dać grać normalnie.

Logika gry jest server-authoritative (funkcje PL/pgSQL w Supabase), klient
tylko renderuje stan.

## Decyzje (z brainstormu)

1. **Zasady**: ręce po splicie asów grywalne (Hit/Stand/Double). As+10 po
   splicie to nadal zwykłe 21 płacące 1:1.
2. **Kierunek wizualny**: dark premium — ewolucja obecnego dark-glass języka
   appki (nie filc, nie flat arcade).
3. **Tempo animacji**: hybryda — żwawe rozdanie i akcje gracza, kinowy finał
   (flip karty krupiera, dobieranie po jednej z pauzami).
4. **Split na mobile**: karuzela scroll-snap z auto-centrowaniem aktywnej ręki,
   peek sąsiednich, bez tekstu-instrukcji.
5. **QoL (wszystkie)**: żetony szybkich stawek + powtórz ostatnią stawkę,
   count-up wypłaty, haptyka (Vibration API), subtelne dźwięki z mute.

## Architektura zmian

### Migracja SQL (`supabase/migrations/20260611...`)

Redefinicja `public.blackjack_split` — jedyna zmiana: nowo utworzone ręce po
splicie asów dostają status `'playing'` zamiast `'stand'`. Flaga `isSplitAces`
zostaje (UI oznacza takie ręce). `_blackjack_next_active_index` i settle
działają bez zmian. Klient niczego nie blokuje po `isSplitAces`, więc zmiana
nie wymaga zmian w API klienta.

### Choreografia odsłaniania (`useBlackjack`)

Serwer zwraca finalny stan od razu; hook utrzymuje **stan widoczny** i kolejkę
kroków odsłaniania wyliczoną z diffu:

- rozdanie / Hit / Split: szybkie (stagger ~0,2 s),
- finał (Stand / Double / bust ostatniej ręki): flip ukrytej karty (~0,4 s) →
  pauza → każda dobrana karta krupiera co ~0,6 s (z aktualizacją punktów) →
  wynik + count-up wypłaty,
- `prefers-reduced-motion`: bez sekwencji, wszystko natychmiast,
- akcje (w tym „Graj ponownie") zablokowane do końca sekwencji.

### UI

- `PlayingCard`: gradient, głębszy cień, 3D flip (rotateY) rewersu do awersu.
- `BlackjackGame`: karuzela rąk ze scroll-snap i auto-scrollem aktywnej ręki na
  środek; nieaktywne przygaszone/pomniejszone; badge „ASY" na rękach po splicie
  asów; po rozstrzygnięciu wynik per ręka (✓/✗/= + kwota); Stand jako główny
  złoty przycisk, pozostałe szklane; info o bucie w jednej linijce; żetony
  stawek 5/10/25/50/100 + x2 + MAX; `bsplic.blackjack.lastStake` w
  localStorage; „Graj ponownie" gra od razu za ostatnią stawkę.
- Dźwięki: syntetyzowane WebAudio (bez assetów), mute w
  `bsplic.blackjack.muted`; haptyka `navigator.vibrate` (iOS ignoruje).

## Testy

- testy choreografii (diff stanów → kroki) i zaktualizowane testy hooka,
  komponentu i API,
- tekstowy test migracji (jak w `blackjackMigration.test.ts`),
- weryfikacja wizualna Playwright na mobile viewport.
