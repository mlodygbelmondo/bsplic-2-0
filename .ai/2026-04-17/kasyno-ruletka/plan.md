# Kasyno + ruletka MVP — implementation plan

## goal
Dodać do aplikacji prostą sekcję kasyna z pierwszą mini-grą ruletka, która pozwala zalogowanemu użytkownikowi postawić zakład z użyciem istniejącego salda i otrzymać rozliczony wynik po bezpiecznym RPC Supabase.

## scope
- nowy route `"/casino"` i link w navbarze,
- proste lobby kasyna z jedną kartą gry: ruletka,
- ekran ruletki z podstawowymi typami zakładów i stawką,
- backendowe, atomowe rozliczenie rundy z aktualizacją `profiles.balance`,
- minimalny zapis rund do tabeli historii kasynowej,
- testy helperów i kluczowego flow UI/API.

## assumptions
- MVP używa europejskiej ruletki (`0-36`, bez `00`).
- Obsługiwane są tylko zakłady: `straight number`, `red/black`, `even/odd`, `low/high`.
- Kasyno korzysta z obecnego demo-portfela (`profiles.balance`), bez nowej waluty.
- Rozliczenie musi być serwerowe, podobnie jak `place_bet_secure`.
- Na MVP nie dodajemy integracji z rankingami, social feedem, badge'ami ani adminowym CMS-em dla kasyna.

## proposed user flow
1. Użytkownik klika `Kasyno` w górnej nawigacji.
2. Trafia na stronę kasyna z krótkim opisem i kartą `Ruletka`.
3. Wybiera typ zakładu, stawkę i kliknięciem uruchamia spin.
4. Klient waliduje podstawowe błędy (brak typu, stawka <= 0, za małe saldo).
5. Front wywołuje RPC Supabase z payloadem rundy.
6. Backend losuje wynik, liczy payout, zapisuje rundę i aktualizuje saldo.
7. UI pokazuje zwycięski numer/kolor, wynik rundy, zmianę salda i odświeża profil.

## likely files to create/modify

### create
- `src/pages/CasinoPage.tsx`
- `src/features/casino/components/CasinoLobby.tsx`
- `src/features/casino/components/RouletteGame.tsx`
- `src/features/casino/components/RouletteBetForm.tsx`
- `src/features/casino/api/roulette.ts`
- `src/features/casino/lib/roulette.ts`
- `src/features/casino/lib/roulette.test.ts`
- `src/features/casino/components/RouletteGame.test.tsx`
- `supabase/migrations/<timestamp>_casino_roulette.sql`

### modify
- `src/App.tsx`
- `src/components/Navbar.tsx`
- `src/components/Navbar.test.tsx`
- `src/types/database.ts`
- `src/integrations/supabase/types.ts`

## state and data considerations
- UI-local state wystarczy dla: wybranego typu zakładu, stawki, loadingu spinu, ostatniego wyniku rundy.
- Nie wygląda na potrzebny nowy React context; można oprzeć się o `useAuth().profile` + `refreshProfile()`.
- Backend powinien dodać tabelę w stylu `casino_rounds` z polami typu: `id`, `user_id`, `game_key`, `bet_type`, `bet_value`, `stake`, `winning_number`, `winning_color`, `payout`, `balance_after`, `created_at`.
- Backend powinien dodać RPC np. `play_roulette_round(p_user_id, p_bet_type, p_bet_value, p_stake)` z atomową walidacją salda, losowaniem, zapisem rundy i aktualizacją balansu.
- Frontend API wrapper powinien zwracać gotowy wynik rundy do renderu, bez duplikowania logiki payoutu w komponencie.

## ui components
- `CasinoPage`: page shell zgodny z aktualnym layoutem aplikacji (`Navbar` + content).
- `CasinoLobby`: nagłówek, stan salda, karta gry `Ruletka`, krótki opis zasad MVP.
- `RouletteGame`: główny kontener gry, ostatni wynik, status spinu.
- `RouletteBetForm`: wybór typu zakładu, wartości zakładu, stawki, CTA `Zakreć`.
- Opcjonalnie prosty wizualny pasek/siatka liczb ruletki zamiast ciężkiej animacji koła — szybciej i bezpieczniej dla MVP.

## ordered implementation steps
1. Doprecyzować model MVP ruletki w kodzie planu wykonawczego: europejska ruletka + 4 grupy zakładów + brak integracji pobocznych.
2. Dodać typy domenowe kasyna po stronie frontu (`RouletteBetType`, `RouletteRoundResult`, helpery kolorów/liczenia payoutu).
3. Przygotować helpery ruletki i testy jednostkowe dla mapowania numer->kolor, walidacji payloadu i oczekiwanych mnożników payoutu.
4. Dodać migrację Supabase tworzącą tabelę historii rund i RPC do bezpiecznego rozegrania rundy.
5. Odświeżyć typy Supabase i dopiąć frontendowy wrapper API dla nowego RPC.
6. Zbudować nowy `CasinoPage` oraz prosty `CasinoLobby` z kartą ruletki i aktualnym saldem.
7. Zbudować `RouletteGame` + `RouletteBetForm` z lokalnym stanem formularza, loadingiem i wynikiem ostatniej rundy.
8. Podłączyć `refreshProfile()` po udanym spinie oraz toasty dla sukcesu/błędów zgodnie z istniejącymi wzorcami.
9. Dodać route w `src/App.tsx` i link `Kasyno` w `Navbar`, a następnie zaktualizować testy navbaru.
10. Dodać test komponentowy dla głównego flow ruletki: walidacja formularza, wywołanie API, render wyniku, odświeżenie profilu.

## verification approach
- Unit: `npm run test -- src/features/casino/lib/roulette.test.ts`
- Component: `npm run test -- src/features/casino/components/RouletteGame.test.tsx`
- Existing nav regression: `npm run test -- src/components/Navbar.test.tsx`
- Lint touched files: `npx eslint src/App.tsx src/components/Navbar.tsx src/components/Navbar.test.tsx src/pages/CasinoPage.tsx src/features/casino/**/*.ts src/features/casino/**/*.tsx`
- Optional confidence check: `npm run build`
- Manual smoke after implementation: login -> wejście do `/casino` -> postawienie poprawnej stawki -> widoczny wynik -> odświeżone saldo.

## risks / open questions
- Największa decyzja produktowa to dokładny zakres zakładów ruletki; plan zakłada wersję uproszczoną, bez pełnej planszy split/corner/dozen.
- Jeśli repo wymaga ręcznej regeneracji `src/integrations/supabase/types.ts`, trzeba to wprost uwzględnić podczas implementacji.
- Losowanie po stronie SQL musi być wystarczająco czytelne i deterministycznie testowalne na poziomie kontraktu wejście/wyjście.

## out-of-scope
- pełna plansza ruletki z advanced bets (split, street, corner, dozen, column),
- osobny panel admina do konfiguracji kasyna,
- historia wszystkich rund gracza jako osobny ekran,
- integracja z social feedem, rankingami, badge'ami i powiadomieniami,
- rozbudowane animacje 3D / fizyka koła.
