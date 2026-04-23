# Kasyno + ruletka MVP — context

## Znormalizowany cel
- Dodać do istniejącej aplikacji nowy feature **Kasyno** oraz pierwszą mini-grę **Ruletka**.
- Zakres ma być **MVP / YAGNI**: jeden prosty entry point do kasyna, jedna grywalna ruletka, bez pobocznych systemów.
- To jest etap **planowania**, bez implementacji kodu.

## Co ma powstać w MVP
- Nowa sekcja / strona kasyna dostępna dla zalogowanego użytkownika.
- Pierwsza gra: ruletka z prostym flow obstawienia, zakręcenia, pokazania wyniku i aktualizacji salda.
- Integracja z istniejącym portfelem użytkownika (`profiles.balance`).
- Minimalny zapis backendowy ruchów kasynowych tak, aby saldo nie było liczone wyłącznie po stronie klienta.

## Kontekst repo po inspekcji
- Routing jest centralnie w `src/App.tsx`.
- Główna nawigacja jest w `src/components/Navbar.tsx` i to tam najłatwiej dodać link do kasyna.
- Dostęp do użytkownika, profilu i odświeżenia salda jest w `src/contexts/AuthContext.tsx`.
- Obecny model ekonomii aplikacji korzysta z bezpiecznych RPC Supabase (`place_bet_secure`, `secure_daily_topup`, `admin_credit_balance`), więc kasyno powinno pójść tą samą ścieżką.
- Typy domenowe aplikacji są trzymane w `src/types/database.ts`, a typy Supabase w `src/integrations/supabase/types.ts`.
- Repo ma już wzorzec folderów feature-level (`src/features/home`, `src/features/social`, `src/features/admin`), więc nowa domena powinna wejść do `src/features/casino`.
- Testy są obok feature/componentów i używają Vitest + Testing Library.

## Najbardziej prawdopodobne punkty integracji
- `src/App.tsx` — dodać route `"/casino"`.
- `src/components/Navbar.tsx` + `src/components/Navbar.test.tsx` — dodać link `Kasyno`.
- `src/pages/CasinoPage.tsx` — nowy route-level page dla lobby/ruletki.
- `src/features/casino/*` — logika UI, helpery i API dla ruletki.
- `supabase/migrations/*` — nowa migracja dla bezpiecznej obsługi rund ruletki.
- `src/integrations/supabase/types.ts` — odświeżone typy po migracji.

## Ograniczenia i zasady
- Trzymać się istniejących wzorców React + Tailwind + shadcn/ui.
- Bez niepowiązanych refaktorów.
- Bez rozbudowy social/ranking/admin, jeśli nie są niezbędne dla MVP.
- UX powinien działać na mobile i desktop, ale bez przesadnej rozbudowy animacji.

## Robocze założenia planistyczne
- MVP ruletki opiera się o **europejską ruletkę (single zero)**.
- MVP wspiera tylko podstawowe typy zakładów: numer, czerwone/czarne, parzyste/nieparzyste, 1-18 / 19-36.
- Wynik rundy i payout są liczone po stronie backendu przez RPC, a klient jedynie wysyła typ zakładu i stawkę.
- Historia rund może być ograniczona do prostego logu technicznego / ostatnich wyników, bez pełnego widoku historii gracza.
- Brak blokującej niejasności, jeśli powyższe założenia są akceptowalne jako MVP.
