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
| 1 | Shell, maintenance, connectivity, themes, providers, role gates | complete | Light/dark, header, menu, natywny dock, focus gating i powroty między trasami sprawdzone na symulatorze. |
| 2 | Login, recovery, refresh, logout | complete | Login email/hasło, logout, ponowny login, sesja i ekran recovery sprawdzone; rejestracji celowo brak. |
| 3 | Sportsbook home | complete | Side-by-side z PWA; przebudowano filtry, jackpot, karty, kursy i stany rozwinięte. Naprawiono crash realtime Social → Zakłady. |
| 4 | Coupon | complete | Zaznaczenie/usunięcie opcji, single/AKO, stawka, podsumowanie i CTA sprawdzone bez postawienia realnego zakładu. |
| 5 | Wallet | complete | Saldo, top-up state, formularz transferu, historia i walidacja sprawdzone bez wysyłania pieniędzy. |
| 6 | Profile | complete | Własny profil, karta gracza, statystyki, historie i akcje sprawdzone wizualnie; upload nie został wykonany na koncie QA. |
| 7 | Rankings | complete | Tryby, metryki, wiersze i nawigacja sprawdzone side-by-side z PWA. |
| 8 | Social | complete | Feed, filtry, kupony/posty/casino, komentarze, share i zwarta reakcja sprawdzone. PWA pokazywało stare stories z cache; świeży RPC zwrócił pustą listę, więc natywna lista jest zgodna z backendem. |
| 9 | YouTube/Spotify | partial | Inline WebView i external fallback są wdrożone; w danych QA nie było aktywnej zawartości obu providerów do ręcznej próby. |
| 10 | Casino lobby | complete | Przebudowane na obrazowe, pionowe karty i porównane z mobilnym PWA. |
| 11 | Roulette | complete | Koło i tło z PWA, stan stołu, gracze, spiny oraz otwarty panel stawki sprawdzone; nie wysłano zakładu. |
| 12 | Blackjack | complete | Tło, stół początkowy, stawka, presety i CTA sprawdzone; akcje serwerowe pozostają za istniejącymi RPC, bez obciążania konta QA. |
| 13 | Jackpot | partial | Karta i wejście do rozliczenia są zgodne wizualnie; realna runda draw/claim nie była dostępna w oknie QA. |
| 14 | Bonuses and feature polls | partial | Natywne overlaye i operacje są wdrożone; backend nie zwrócił aktywnej kampanii/ankiety do wymuszenia powierzchni. |
| 15 | In-app notifications | complete | Sheet, unread, preferencja dźwięku i lifecycle kanału realtime sprawdzone ręcznie. |
| 16 | Admin/moderator | complete | Role gate, dashboard, taby i dane administratora sprawdzone na istniejącym koncie admin; nie wykonywano mutacji settle/refund/create. |

Nie ma pozycji `not started`. Pozostałe trzy pozycje `partial` są zależne od chwilowych danych backendu, a nie od brakującej trasy lub atrapy. Wszystkie dostępne powierzchnie zostały przejrzane w bezpiecznej, uwierzytelnionej sesji.

## Walidacja wykonana

- `mobile: npx tsc --noEmit` — pass.
- `mobile: npm run lint` — pass, 0 błędów; 5 ostrzeżeń Fast Refresh w providerach.
- `mobile: npx expo-doctor` — wcześniej 20/20; końcowa próba offline wykonała 18/20, a dwie kontrole wymagające Expo API nie mogły rozwiązać `exp.host` (nie jest to błąd projektu).
- `mobile: npx expo export --platform ios` — pass, 3707 modułów, Hermes bundle około 7 MB.
- `mobile: npx expo export --platform android` — pass, 3780 modułów, Hermes bundle około 7,2 MB.
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

## Niezależny review

Pierwszy przegląd znalazł błędy auth recovery, uploadu avatarów, kluczy realtime social, lifecycle ukrytych tras, motywów, offline admina, atomowości SecureStore i brak formularza propozycji. Wszystkie zostały naprawione. Druga runda dodatkowo wykorzystała przygotowane mechanizmy prezentacji casino: koło ruletki, staged reveal blackjacka, publikację wygranej do Socialu i foreground resync Jackpotu. Końcowy re-review nie znalazł żadnych actionable P1/P2. Powierzchnie nadal pozostają `partial`, dopóki nie powstanie wiarygodny manualny dowód na iOS.

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
