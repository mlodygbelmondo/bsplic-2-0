# BSPLIC Expo migration status

Ostatnia aktualizacja: 2026-07-21  
Gałąź: `codex/expo-migration`  
Umowa: [`expo-migration-contract.md`](./expo-migration-contract.md)

Ten plik jest trwałą referencją wykonania migracji. Statusy odnoszą się do rygorystycznej definicji ukończenia z umowy: realny backend, kompletne stany i nawigacja, zgodność mobilnego designu oraz ręczne przejście albo wiarygodny test. `Partial` nie oznacza atrapy — oznacza, że implementacja istnieje, lecz nie uzyskała jeszcze całego wymaganego dowodu manualnego lub wizualnego.

## Zakres wykonany w kodzie

- Expo SDK 57, Expo Router, React Native, NativeWind, natywny design system i Inter.
- Bezpieczna sesja Supabase w SecureStore, cache odczytów i preferencji w SQLite KV, obsługa offline/reconnect/foreground.
- Natywne ścieżki: auth, sportsbook, kupon, profil, social, rankingi, casino, ruletka, blackjack, jackpot draw, admin i reset hasła.
- Produkcyjne operacje Supabase/RPC, realtime, upload mediów, WebView, audio i haptics.
- Pełny panel administratora/moderatora bez zmian w istniejącej aplikacji webowej.
- Brak ekranów udających gotowe funkcje; brak rejestracji, magic linka, push notifications i tras developerskich zgodnie z umową.

## Pełny inwentarz

| # | Obszar | Status | Stan i brakujący dowód |
|---|---|---|---|
| 1 | Shell, maintenance, connectivity, themes, providers, role gates | partial | Zaimplementowane; główne powierzchnie używają tokenów light/dark, a ciężkie subskrypcje są focus-gated. Brak pełnego przejścia obu motywów na symulatorze. |
| 2 | Login, recovery, refresh, logout | partial | Email/hasło, odzyskiwanie i bezpieczna sesja są wdrożone; dodano retry/logout po błędzie profilu. Brak końcowego testu na zalogowanym symulatorze. |
| 3 | Sportsbook home | partial | Kategorie, filtry, sortowanie, paginacja, focus-gated realtime, zaznaczanie opcji, cache i natywny formularz propozycji są wdrożone. Brak manualnego porównania z PWA. |
| 4 | Coupon | partial | Persistencja, single/AKO, exclusions, walidacja, bezpieczne RPC, saldo i kopiowanie social są wdrożone. Brak manualnego zakładu na koncie QA w finalnym buildzie. |
| 5 | Wallet | partial | Saldo, daily top-up, transfer z UUID idempotency, historia i właściwa granica sukcesu są wdrożone. Brak końcowej próby produkcyjnej. |
| 6 | Profile | partial | Profil własny/publiczny, statystyki, historie, badges, share oraz avatar z aparatu/galerii, kompresją i ArrayBuffer są wdrożone. Brak manualnego uploadu. |
| 7 | Rankings | partial | Tryby sportsbook/casino, sortowanie, metryki i cache są wdrożone. Brak wizualnego QA. |
| 8 | Social | partial | Feed, posty, stories, obrazy, mentions/Eniu, komentarze/wątki, reakcje/reactors, filtry, linki, kopiowanie kuponu, share i realtime są wdrożone. Brak końcowego przejścia produkcyjnego. |
| 9 | YouTube/Spotify | partial | Bezpieczny inline WebView i external fallback są wdrożone. Brak ręcznej próby obu providerów. |
| 10 | Casino lobby | partial | Lobby i nawigacja są wdrożone. Brak screenshot comparison. |
| 11 | Roulette | partial | Snapshot serwera, focus-gated realtime/countdown, obstawianie, uczestnicy, historia, animowane koło z reduced motion, audio/haptics oraz share system/Social są wdrożone. Brak manualnego QA animacji. |
| 12 | Blackjack | partial | Serwerowe hit/stand/double/split/insurance, etapowe odkrywanie krupiera, karty, reduced motion, audio/haptics/share i celebracja są wdrożone. Brak wizualnego QA finału. |
| 13 | Jackpot | partial | Karta, focus-gated polling, zakup, deep link, draw, resync po foreground, claim są wdrożone. Brak przejścia realnej rundy na symulatorze. |
| 14 | Bonuses and feature polls | partial | Natywne overlaye i operacje są wdrożone. Brak manualnego QA. |
| 15 | In-app notifications | partial | Realtime, unread, nawigacja, preferencja dźwięku, audio/haptics są wdrożone; push celowo pominięty. Brak manualnego QA. |
| 16 | Admin/moderator | partial | Dashboard, bets/create/settle/refund/corrections/AKO, proposals, categories, Eniu, bonus i polls są wdrożone z role gates oraz centralną blokadą operacji offline. Brak końcowego przejścia kontem admina. |

Nie ma pozycji `not started`. Status `partial` wynika głównie z braku końcowego uwierzytelnionego walkthrough oraz — w dwóch grach casino — z uproszczonej prezentacji ruchu. Nie wolno zmieniać tych statusów na `complete` bez zebrania wskazanego dowodu.

## Walidacja wykonana

- `mobile: npx tsc --noEmit` — pass.
- `mobile: npm run lint` — pass, 0 błędów; 5 ostrzeżeń Fast Refresh w providerach.
- `mobile: npx expo-doctor` — wcześniej 20/20; końcowa próba offline wykonała 18/20, a dwie kontrole wymagające Expo API nie mogły rozwiązać `exp.host` (nie jest to błąd projektu).
- `mobile: npx expo export --platform ios` — pass, 3700 modułów, Hermes bundle około 7 MB.
- `mobile: npx expo export --platform android` — pass, 3780 modułów, Hermes bundle około 7,2 MB.
- Root: `npm run lint` — pass z istniejącymi ostrzeżeniami.
- Root: `npm run build` — pass, włącznie z generacją PWA.
- Root: pełny Vitest został zabity przez limit RAM (`exit 137`); przebieg single-worker wykonał liczne zestawy, ale nie zwrócił kompletnego finalnego podsumowania, więc nie jest raportowany jako pełny pass.
- iOS Simulator został uruchomiony, ale Expo Go nie zainstalowało/nie otworzyło projektu w dostępnym runtime. Nie ma wiarygodnego manualnego ani screenshotowego potwierdzenia aplikacji.
- Android emulator celowo nie został uruchomiony.

## Commity migracji

- `6e7ea1c` — scaffold Expo.
- `e155885` — główna migracja doświadczenia BSPLIC.
- `d629389` — lifecycle i operacje finansowe.
- `65f4110` — bezpieczeństwo wagering/transfer, identity i AKO.
- `7945329` — recovery auth, natywny upload avatarów i realtime social.
- `e6c0cc4` — trwały handoff oraz końcowe edge case auth/realtime.
- `a65432c` — parytet motywów, lifecycle, propozycje, casino i atomowy storage.

## Niezależny review

Pierwszy przegląd znalazł błędy auth recovery, uploadu avatarów, kluczy realtime social, lifecycle ukrytych tras, motywów, offline admina, atomowości SecureStore i brak formularza propozycji. Wszystkie zostały naprawione. Druga runda dodatkowo wykorzystała przygotowane mechanizmy prezentacji casino: koło ruletki, staged reveal blackjacka, publikację wygranej do Socialu i foreground resync Jackpotu. Końcowy re-review nie znalazł żadnych actionable P1/P2. Powierzchnie nadal pozostają `partial`, dopóki nie powstanie wiarygodny manualny dowód na iOS.

## Wymagane działania zewnętrzne

1. Podać Apple Team ID i opublikować poprawny `https://bsplic.vercel.app/.well-known/apple-app-site-association` dla `pl.bsplic.app`.
2. Po utworzeniu klucza podpisującego Android podać SHA-256 certyfikatu i opublikować `https://bsplic.vercel.app/.well-known/assetlinks.json`.
3. Dodać do Supabase Auth redirect allow-list co najmniej `https://bsplic.vercel.app/reset-password` i `bsplic://reset-password`.
4. Skonfigurować Apple signing, EAS project/store credentials oraz późniejsze build/submit.
5. Wykonać uwierzytelniony walkthrough na iOS, side-by-side z PWA, używając istniejących kont QA i bez nieodwracalnych operacji produkcyjnych.
6. Wykonać później Android QA na urządzeniu/emulatorze; statyczny eksport Androida przechodzi.

## Granice bezpieczeństwa

- Nie wykonano push ani publikacji.
- Nie zastosowano migracji SQL do produkcji.
- Nie zapisano sekretów ani poświadczeń testowych.
- Istniejąca aplikacja Vite/PWA nie otrzymała zmian funkcjonalnych ani wizualnych; jedyna zmiana poza `mobile/` i `.ai/docs/` to odnośnik do tej umowy w `AGENTS.md`.
