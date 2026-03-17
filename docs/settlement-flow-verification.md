# Weryfikacja rozliczenia wyniku zakladu

Ten dokument opisuje, co powinno dzialac po kliknieciu "Oglos wynik" w panelu admina oraz jak to sprawdzic recznie.

## 1) Co dzieje sie po ogloszeniu wyniku

1. Admin wybiera zwycieska opcje dla danego zakladu (`bets.winning_option`) i zaklad jest zamykany (`is_active = false`).
2. System pobiera wszystkie rekordy z `placed_bets` dla tego `bet_id`.
3. Dla kazdego nierozliczonego wpisu (`result = pending`):
   - ustawia `result` na `won` albo `lost`,
   - wylicza `payout` dla nogi kuponu (`stake * odds_at_time` dla wygranej, `0` dla przegranej).
4. Jesli noga nalezy do kuponu AKO, trigger `resolve_coupon_status` aktualizuje rekord `coupons`:
   - `status = won` i `payout = stake * total_odds`, gdy wszystkie nogi wygrane,
   - `status = lost` i `payout = 0`, gdy min. jedna noga przegrana.
5. Frontend liczy kredyt do salda:
   - single: wygrana noga daje natychmiastowy kredyt `legPayout`,
   - AKO: kredyt jest dopiero przy przejsciu kuponu z `pending` -> `won`,
   - AKO przegrany nie daje kredytu.
6. Kredyty sa agregowane po `user_id` i dopiero potem dopisywane do `profiles.balance` (jedna doplata na uzytkownika na rozliczany mecz).

## 2) Najwazniejsze miejsca ryzyka

- **RLS / uprawnienia:** aktualizacja `profiles.balance` przez admina musi isc przez funkcje SQL z `SECURITY DEFINER` (w projekcie: `admin_credit_balance`).
- **AKO i podwojne naliczenie:** kredyt AKO wolno przyznac tylko raz, przy przejsciu kuponu na `won`.
- **Rownolegle wygrane wielu osob:** doplata musi obejmowac wszystkich userow, nie tylko pierwszego znalezionego.

## 3) Szybka checklista reczna (minimum)

1. Przygotuj dwoch userow (admin + zwykly), obaj obstawiaja ten sam zaklad jako wygrany.
2. Zanotuj saldo obu userow przed rozliczeniem.
3. Admin oglasza wynik zgodny z ich typem.
4. Sprawdz w bazie:
   - `placed_bets.result` zmienione z `pending` na `won`,
   - `placed_bets.payout` poprawnie wyliczone,
   - `profiles.balance` obu userow wzroslo o oczekiwana kwote.
5. Powtorz test dla kuponu AKO (2+ nogi), gdzie rozliczana noga jest ostatnia i zamyka kupon na `won`.

## 4) Query SQL do weryfikacji

Podmien `BET_ID` i ewentualnie `USER_ID`.

```sql
-- 1. Wszystkie nogi dla rozliczanego zakladu
select id, user_id, bet_id, coupon_id, selected_option, odds_at_time, stake, result, payout
from public.placed_bets
where bet_id = 'BET_ID'
order by created_at asc;

-- 2. Powiazane kupony
select c.id, c.user_id, c.total_odds, c.stake, c.status, c.payout, c.created_at
from public.coupons c
where c.id in (
  select distinct coupon_id
  from public.placed_bets
  where bet_id = 'BET_ID' and coupon_id is not null
)
order by c.created_at desc;

-- 3. Salda userow, ktorzy mieli nogi w tym meczu
select p.id, p.username, p.balance
from public.profiles p
where p.id in (
  select distinct user_id
  from public.placed_bets
  where bet_id = 'BET_ID'
)
order by p.username;
```

## 5) Oczekiwane wyniki

- Single wygrany: `profiles.balance` rośnie o `stake * odds_at_time`.
- Single przegrany: saldo bez zmian.
- AKO przed ostatnia noga: saldo bez zmian.
- AKO po ostatniej wygranej nodze: saldo rośnie o `coupon.stake * coupon.total_odds` (lub `coupon.payout`, jesli juz wyliczone).
- AKO przegrany: saldo bez zmian.

## 6) Dodatkowe zmiany UX w projekcie

- Tworzenie nowego zakladu i propozycji domyslnie ustawia date na **jutro 23:59**.
- W module akceptacji propozycji admin dostaje poprawny prefill danych propozycji (w tym `ends_at`, gdy dostepne).
- W historii kuponow, gdy `total_odds` wpada jako `1.00`, UI probuje pokazac sensowny kurs z nog kuponu zamiast stalego `1.00`.
