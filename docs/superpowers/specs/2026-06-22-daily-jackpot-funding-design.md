# Jackpot Dnia — funding fairness update

Data: 2026-06-22 • Status: zatwierdzony przez Piotra

## Cel

Zmienić finansowanie Jackpotu Dnia tak, żeby było prostsze do obrony przed
graczami: pula nie zabiera całych przegranych sportsbookowych stawek, a zakup
ticketu realnie zwiększa pulę losowania.

## Decyzje

1. Do puli trafia **20% stawek przegranych kuponów sportsbookowych z
   poprzedniego dnia** według czasu `Europe/Warsaw`.
2. Do puli trafia **100% ceny każdego kupionego ticketu** dla aktywnej puli.
3. Kasyno nie zasila Jackpotu w tej zmianie.
4. Jeśli losowanie nie dojdzie do skutku z powodu zbyt małej liczby unikalnych
   graczy, tickety są zwracane i ich wkład nie przechodzi na kolejną pulę.
5. Rollover na kolejny dzień przenosi tylko środki, które nie pochodzą ze
   zwróconych ticketów.

## Architektura zmian

### SQL

- Dodać świeżą migrację Supabase, bez edycji już istniejących migracji.
- Zmienić `private.sync_daily_jackpot_funding(date)` tak, żeby wpisy
  `lost_coupon` miały `amount = ROUND(c.stake * 0.20, 2)`.
- Rozszerzyć `daily_jackpot_funding_entries.source_type` o źródło zakupu
  ticketu, najlepiej `ticket_purchase`.
- Powiązać wpis finansowania ticketu z konkretnym rekordem
  `daily_jackpot_tickets`, żeby zakup był idempotentny i audytowalny.
- Zmienić `public.buy_daily_jackpot_ticket(uuid)` tak, żeby po pobraniu środków
  i utworzeniu ticketu dopisywał funding entry na pełną cenę ticketu oraz
  przeliczał `daily_jackpot_pools.prize_amount`.
- Przy rolloverze z puli bez minimalnej liczby graczy przenieść tylko sumę
  źródeł innych niż `ticket_purchase`, bo tickety są zwracane.

### UI copy

Modal informacyjny przy etykiecie `Pula` powinien mówić krótko:

> Pula Jackpotu Dnia rośnie z 20% stawek przegranych kuponów z poprzedniego
> dnia oraz z kupionych ticketów w aktualnym losowaniu. Im większy ruch w grze,
> tym większa pula do zgarnięcia.

## Testy

- Test migracji: `lost_coupon` używa mnożnika `0.20`, a nie pełnej stawki.
- Test migracji: zakup ticketu tworzy wpis `ticket_purchase` i aktualizuje
  `prize_amount`.
- Test migracji: rollover po zwrocie ticketów nie przenosi źródeł
  `ticket_purchase`.
- Istniejące testy jackpot API i komponentu powinny przejść po aktualizacji
  oczekiwań dotyczących copy.
