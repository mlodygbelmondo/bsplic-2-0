# Ruletka 2.0 — refinement (spec)

Data: 2026-06-11. Zatwierdzone w brainstormingu (warianty wybrane przez Piotra).

## Cel

Podnieść frajdę i czytelność wspólnej ruletki bez dotykania serwerowej logiki
rozliczania. Tylko frontend + szerszy limit historii spinów w istniejącym RPC.

## 1. Koło — pełny realizm + hub wyniku

- Podczas spinu obraca się **samo koło** (obrazek), hamując do pełnego
  zatrzymania; kulka leci w przeciwną stronę. Wspólny czas i easing
  (`cubic-bezier(0.2, 0.8, 0.25, 1)`), jak dotychczasowa kulka.
- Końcowy obrót koła jest **deterministyczny**: hash `roundId` → kąt
  docelowy (pełne obroty + reszta), więc każdy klient widzi to samo.
- Finalny kąt kulki = `obrót koła + kąt kieszeni + offset numeru`.
  **Istniejące offsety z `ROULETTE_BALL_NUMBER_ANGLE_OFFSETS_DEG` zostają bez
  zmian** — są zdefiniowane względem grafiki koła.
- Koło zatrzymuje się całkowicie w momencie osadzenia kulki — po rozliczeniu
  nic nie dryfuje.
- Hub w środku koła (środek grafiki jest ciemny):
  - faza `waiting`: duży countdown `0:12` + podpis "do spinu",
  - faza `spinning`: pulsujące "KRĘCI SIĘ",
  - faza `settled`: duży numer + nazwa koloru, kolorowy ring + flash.
- `CasinoRouletteDevPage` pozostaje narzędziem kalibracji: renderuje prawdziwy
  komponent, więc pokazuje nową animację; offsety stroi się jak dotąd.
- Testy: dla wszystkich 37 numerów kąt względny kulka↔koło = kieszeń + offset,
  niezależnie od obrotu koła; determinizm hashu roundId.

## 2. Audio + haptyka

- `casinoAudio.ts` — syntezowane WebAudio (bez plików): tick kulki zwalniający
  zgodnie z krzywą animacji, chime wygranej.
- Wibracje (`navigator.vibrate`) przy osadzeniu kulki i przy wygranej.
- Mute toggle przy kole, persystowany w `bsplic.casino.sound`.

## 3. Pasek „Grasz" pod kołem

- Kompaktowe chipy zakładów zalogowanego usera w bieżącej rundzie
  (`Czarne · 500`), kolorowane pod kolor ruletki, + `max → 4600 zł` (suma
  potencjalnych wypłat).
- Po rozliczeniu: chip ✓ zielony / ✗ przygaszony, komunikat
  **„Wypadło 17 czarne"** (feedback również przy przegranej) oraz przycisk
  **„Powtórz"** — stawia te same zakłady na nową rundę (walidacja salda).
- Bez osobnej karty "Twoje zakłady" (wybrano wariant paska).

## 4. Gracze w rundzie — per zakład (wariant B)

- Grupowanie po graczu zostaje: avatar, nick, liczba zakładów, **suma**.
- Pod spodem każdy zakład osobną linią: kolorowy chip typu/wartości +
  **stawka tego zakładu** (dane już są w `participant.bets[].stake`).

## 5. Panel zakładów jak stół

- Siatka 0–36 w kolorach ruletki (zielone 0, czerwone/czarne) — styl jak na
  stronie dev.
- „Czerwone"/„Czarne" faktycznie kolorowe; parzystość/zakres stylizowane.
- Mnożnik widoczny przy opcjach (x36/x2).
- Po rozliczeniu trafione pole podświetla się chwilowo.
- Pasek stawki: podgląd potencjalnej wygranej na żywo (stawka × mnożnik),
  przycisk **MAX** (całe saldo), „Postaw" nieaktywny z podpowiedzią czego
  brakuje, dopóki wybór niekompletny.

## 6. Statystyki i delight

- Karta statystyk w lewej kolumnie: top 3 hot / top 3 cold numerów + pasek
  rozkładu czerwone/czarne/zielone z ostatnich ~50 spinów
  (`recentSpinsLimit` w istniejącym snapshocie).
- Badge serii przy historii spinów („3× czerwone z rzędu").
- Kwota w banerze wygranej nabija się count-upem od zera.

## Poza zakresem

- Zmiany w SQL/rozliczaniu rund, nowe RPC, zmiany grafiki koła.

## Weryfikacja

- `npm run lint`, testy, build (pre-existing błędy tsc nie są regresją).
- Ręcznie: strona dev (lądowanie kulki na wybranych numerach), pełna runda
  na stole.
