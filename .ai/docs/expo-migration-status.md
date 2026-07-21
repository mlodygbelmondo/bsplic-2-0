# BSPLIC Expo migration status

Ostatnia aktualizacja: 2026-07-21  
Gałąź: `codex/expo-migration`  
Umowa: [`expo-migration-contract.md`](./expo-migration-contract.md)

Ten plik jest trwałą referencją wykonania migracji. Statusy odnoszą się do rygorystycznej definicji ukończenia z umowy: realny backend, kompletne stany i nawigacja, zgodność mobilnego designu oraz ręczne przejście albo wiarygodny test. Końcowa pętla QA została wykonana na iPhone 17 Pro (iOS 26.5), na uwierzytelnionym koncie QA i side-by-side z produkcyjnym PWA. Operacje finansowe, publikacje i uploady nie były wykonywane tylko po to, aby uzyskać dowód — sprawdzono ich formularze, walidację i kod bez nieodwracalnej mutacji danych.

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
| 1 | Shell, maintenance, connectivity, themes, providers, role gates | partial | Light/dark, header, menu, natywny dock, focus gating i powroty sprawdzone. Produkcyjny maintenance i pełne odcięcie sieci nie były wymuszane; kod i UI tych stanów są obecne. |
| 2 | Login, recovery, refresh, logout | partial | Login, invalid credentials, sesja i invalid recovery sprawdzone; brak aktywnego jednorazowego tokenu do bezpiecznego wykonania recovery success/expired. |
| 3 | Sportsbook home | partial | Side-by-side z PWA; przebudowano filtry, jackpot, karty i kursy, a realtime bets/categories jest focus-gated. Brak reprezentatywnych closed/in-progress cards i pełnego error/empty renderu w danych QA. |
| 4 | Coupon | partial | Zaznaczenie/usunięcie opcji, single/AKO, stawka, podsumowanie i CTA sprawdzone bez postawienia zakładu; nie wszystkie warianty exclusions/copied-social wystąpiły w danych QA. |
| 5 | Wallet | complete | Saldo, top-up state, formularz transferu, historia i walidacja sprawdzone bez wysyłania pieniędzy. |
| 6 | Profile | partial | Własny/publiczny profil, karta gracza, statystyki, historie i akcje sprawdzone wizualnie; upload oraz missing-user nie zostały wykonane na koncie QA. |
| 7 | Rankings | partial | Tryby, metryki, wiersze i nawigacja sprawdzone side-by-side z PWA; wymuszone empty/error nie były dostępne w danych QA. |
| 8 | Social | partial | Feed, filtry, kupony/posty/casino, komentarze, composer, mention i draft sprawdzone. Nie publikowano treści/reakcji tylko dla dowodu; brak aktywnego story i kart YouTube/Spotify ograniczył manualny zakres. |
| 9 | YouTube/Spotify | partial | Inline WebView i external fallback są wdrożone; w danych QA nie było aktywnej zawartości obu providerów do ręcznej próby. |
| 10 | Casino lobby | complete | Przebudowane na obrazowe, pionowe karty i porównane z mobilnym PWA. |
| 11 | Roulette | partial | Koło, pionowe tło, stan waiting, wygrane i open/closed panel stawki sprawdzone; nie wysłano zakładu, a dynamicznego cyklu spinning/settled nie wymuszano. |
| 12 | Blackjack | partial | Pionowe tło i aktywna gra z hit/stand/double zostały sprawdzone; foreground anuluje reveal i pobiera świeży stan serwera. Nie wykonywano akcji ani nie wymuszano wszystkich stanów insurance/split/settled. |
| 13 | Jackpot | partial | Karta i wejście do rozliczenia są zgodne wizualnie; realna runda draw/claim nie była dostępna w oknie QA. |
| 14 | Bonuses and feature polls | partial | Natywne overlaye i operacje są wdrożone; backend nie zwrócił aktywnej kampanii/ankiety do wymuszenia powierzchni. |
| 15 | In-app notifications | complete | Sheet, unread, preferencja dźwięku, deep link i lifecycle kanału realtime sprawdzone ręcznie. |
| 16 | Admin/moderator | partial | Denied oraz pełny admin, dashboard, wszystkie taby, walidacje, paginacje i bezpieczne confirmation modals sprawdzone. Brak konta moderatora i brak produkcyjnych mutacji settle/refund/create. |

Nie ma pozycji `not started`. Każdy obszar i wszystkie 44 powierzchnie z `expo-screen-audit.md` zostały sklasyfikowane. Status `partial` oznacza brak wiarygodnego dowodu dla co najmniej jednego warunkowego lub mutującego stanu, a nie brak trasy czy atrapę. Dostępne powierzchnie zostały przejrzane w bezpiecznej, uwierzytelnionej sesji; szczegółowy dowód i ograniczenia są w macierzy ekranów.

## Walidacja wykonana

- `mobile: npx tsc --noEmit` — pass.
- `mobile: npm run lint` — pass, 0 błędów; 5 ostrzeżeń Fast Refresh w providerach.
- `mobile: npx expo-doctor` — wcześniej 20/20; końcowa próba offline wykonała 18/20, a dwie kontrole wymagające Expo API nie mogły rozwiązać `exp.host` (nie jest to błąd projektu).
- `mobile: npx expo export --platform ios` — pass, 3707 modułów, Hermes bundle około 7 MB.
- `mobile: npx expo export --platform android` — pass, 3780 modułów, Hermes bundle około 7,2 MB.
- Końcowa runda po audycie: iOS export — pass, 3710 modułów, Hermes 7,1 MB; Android export — pass, 3790 modułów, Hermes 7,3 MB.
- Końcowa próba `npx expo-doctor` nie zwróciła wyniku i została przerwana po zawieszeniu na kontroli sieciowej; zachowano wcześniejszy wynik opisany wyżej, bez raportowania nowej próby jako pass.
- Root: `npm run lint` — pass z istniejącymi ostrzeżeniami.
- Root: `npm run build` — pass, włącznie z generacją PWA.
- Root: pełny Vitest został zabity przez limit RAM (`exit 137`); przebieg single-worker wykonał liczne zestawy, ale nie zwrócił kompletnego finalnego podsumowania, więc nie jest raportowany jako pełny pass.
- iOS Simulator: pass na iPhone 17 Pro, iOS 26.5. Expo Go uruchomiło aplikację, zachowało sesję Supabase i pozwoliło przejść cały dostępny inwentarz. Zebrano czyste screenshoty stanów jasnych/ciemnych, kasyna, formularzy i nawigacji.
- Android emulator celowo nie został uruchomiony.

## Commity migracji

- `6e7ea1c` — scaffold Expo.
- `e155885` — główna migracja doświadczenia BSPLIC.
- `d629389` — lifecycle i operacje finansowe.
- `65f4110` — bezpieczeństwo wagering/transfer, identity i AKO.
- `7945329` — recovery auth, natywny upload avatarów i realtime social.
- `e6c0cc4` — trwały handoff oraz końcowe edge case auth/realtime.
- `a65432c` — parytet motywów, lifecycle, propozycje, casino i atomowy storage.
- `e059eb0` — wizualne zbliżenie natywnego UI do mobilnego PWA.
- `a784e70` — naprawy parytetu z pełnego audytu ekranów, w tym blackjack, ruletka i tła Jackpotu.
- `0946043` — końcowe korekty auth, wallet, admina, theme/offline oraz kompletna macierz 44 powierzchni.
- `88d7a9a` — poprawki końcowego review: lifecycle Blackjacka, izolacja draftów, avatar 140 KB, realtime, recovery i powiadomienia.

## Niezależny review

Pierwszy przegląd znalazł błędy auth recovery, uploadu avatarów, kluczy realtime social, lifecycle ukrytych tras, motywów, offline admina, atomowości SecureStore i brak formularza propozycji. Wszystkie zostały naprawione. Druga runda dodatkowo wykorzystała przygotowane mechanizmy prezentacji casino: koło ruletki, staged reveal blackjacka, publikację wygranej do Socialu i foreground resync Jackpotu. Końcowy re-review nie znalazł żadnych actionable P1/P2. Powierzchnie nadal pozostają `partial`, dopóki nie powstanie wiarygodny manualny dowód na iOS.

Po pełnym audycie 44 powierzchni dodatkowy niezależny review całego diffu wykrył P2 w lifecycle Blackjacka, izolacji draftów Social, limicie avatara, focus-gating realtime kategorii, recovery fallbacku, obsłudze błędów powiadomień i rzetelności statusów. Wszystkie zostały poprawione; ponowny review aktualnego worktree zakończył się werdyktem „brak dalszych actionable P0–P2”.

## Wymagane działania zewnętrzne

1. Podać Apple Team ID i opublikować poprawny `https://bsplic.vercel.app/.well-known/apple-app-site-association` dla `pl.bsplic.app`.
2. Po utworzeniu klucza podpisującego Android podać SHA-256 certyfikatu i opublikować `https://bsplic.vercel.app/.well-known/assetlinks.json`.
3. Dodać do Supabase Auth redirect allow-list co najmniej `https://bsplic.vercel.app/reset-password` i `bsplic://reset-password`.
4. Skonfigurować Apple signing, EAS project/store credentials oraz późniejsze build/submit.
5. Wykonać później Android QA na urządzeniu/emulatorze; statyczny eksport Androida przechodzi.
6. Gdy backend wystawi aktywny draw jackpotu, bonus/poll lub post z YouTube/Spotify, wykonać krótkie QA tych warunkowych stanów.

## Granice bezpieczeństwa

- Nie wykonano push ani publikacji.
- Nie zastosowano migracji SQL do produkcji.
- Nie zapisano sekretów ani poświadczeń testowych.
- Istniejąca aplikacja Vite/PWA nie otrzymała zmian funkcjonalnych ani wizualnych; jedyna zmiana poza `mobile/` i `.ai/docs/` to odnośnik do tej umowy w `AGENTS.md`.
