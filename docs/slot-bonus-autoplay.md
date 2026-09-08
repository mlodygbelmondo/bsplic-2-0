# Piętnaście mniejszych obrotów z automatyczną grą

## Mechanika

Cztery symbole BONUS na pierwszej planszy przyznają 15 darmowych obrotów. Każda darmowa kaskada płaci 75% zwykłej wypłaty, zaokrąglone do 0,01 po zsumowaniu grup. Limit wypłaty nadal wynosi 200× stawki na obrót. Stawka pozostaje zablokowana, a darmowe obroty nie przyznają kolejnych bonusów.

W porównaniu z pierwotnymi 10 zwykłymi darmowymi obrotami daje to w przybliżeniu 12,5% większą wartość całego bonusu: 15 × 0,75 ÷ 10 = 1,125. Zaokrąglenia i ograniczenie wysokich wypłat wpływają na dokładną proporcję. Wcześniejsza lokalna propozycja ×2 została usunięta przed wdrożeniem.

Szansa zdobycia bonusu nie zmieniła się: 0,63680003% płatnych obrotów, średnio raz na 157,04 obrotu. Płatne tabele wypłat pozostają bez zmian. Dawny raport kalibracji 90% opisuje wersję z dziesięcioma obrotami.

## Automatyczna gra

Frontend sam uruchamia zapisany albo właśnie zdobyty bonus. Czeka na zakończenie animacji i 900 ms przed kolejnym darmowym obrotem. Przycisk pauzy zatrzymuje serię przed następnym żądaniem. Ukrycie karty, zakończenie sesji, opuszczenie strony albo błąd przerywają automat. Wysłany obrót kończy swoje rozliczenie.

Automat używa `casino_slot_bonus_spin`. Funkcja blokuje wiersz portfela i sprawdza, czy pozostały darmowe obroty. Żądanie po wyczerpaniu bonusu zwraca `BONUS_FINISHED`, bez pobierania stawki. Dotyczy to także równoczesnych żądań z dwóch kart. Ponowienie zapisuje i zachowuje zarówno UUID, jak i tryb darmowego obrotu. Po ostatnim obrocie klient czeka na ręczne rozpoczęcie płatnej gry, nawet jeśli odczyt stanu zwróci starszy licznik.

## Pomiar

Rzeczywisty RPC PostgreSQL w tymczasowej bazie, stawka 10, ziarno 0.314159. Po 20 000 płatnych obrotów na grę plus wszystkie darmowe obroty. Lucky shot nie występuje w ciągłej grze.

| Gra | Liczba bonusów | Średnia wypłata całego bonusu | Zwrot próbki | Orientacyjny margines 95% |
| --- | ---: | ---: | ---: | ---: |
| Bandit | 137 | 8,64× stawki | 89,14% | ±4,18 pp |
| Candy | 149 | 9,81× stawki | 94,75% | ±2,94 pp |
| Ember | 137 | 8,63× stawki | 89,00% | ±4,22 pp |
| Tide | 140 | 9,94× stawki | 93,52% | ±2,84 pp |

W pierwotnej wersji z 10 obrotami próbka z tym samym ziarnem dała odpowiednio 7,81×, 8,72×, 7,80× i 8,76× stawki na bonus. Dłuższe bonusy zużywają więcej losowań, więc przebiegi nie mają identycznych plansz. Wyniki próbek nie są dokładnym RTP ani gwarancją wypłaty.

```bash
SLOT_SIMULATE=1 SLOT_SIMULATION_SPINS=20000 bash scripts/test-casino-slots.sh
SLOT_SIMULATE=1 SLOT_SIMULATION_SPINS=20000 SLOT_SIMULATION_ORIGINAL_BONUS=1 bash scripts/test-casino-slots.sh
```

## Weryfikacja i wydanie

Lokalne testy SQL obejmują 15 przyznanych obrotów, wypłaty 75% w czterech grach, zaokrąglenia przy stawkach 1, 5 i 250, saldo, ostatni obrót, ponowienia, limit ×200, brak dostępu anonimowego oraz wyścig dwóch żądań o ostatni darmowy obrót. Vitest: 17 testów. Playwright: 18 scenariuszy Chromium/WebKit, w tym pauza, wznowienie i ponowienie darmowego żądania po przeładowaniu. Build poprawny, lint bez błędów i z 16 istniejącymi ostrzeżeniami.

8 września 2026 wdrożono `20260908154500_remove_slot_max_stake.sql` i `20260908160000_slot_bonus_autoplay.sql` na Supabase `bsplic 2.0` (`imucpqgglvarpoezhbdb`). Historia migracji, treść funkcji, limit 15 obrotów i uprawnienia endpointu zostały potwierdzone po wdrożeniu. Użyto Management API, bez zapisywania tokenu do plików. Frontend pozostaje lokalny i wymaga osobnego opublikowania na Vercel; samo wdrożenie migracji nie publikuje automatycznego rozgrywania bonusu. Stara wersja klienta ma limit walidacji 10 obrotów i nie obsługuje nowych bonusów z 15 obrotami. Istniejące bonusy zachowują licznik, kolejne zdobyte przyznają 15 obrotów. Niewykorzystane obroty od wdrożenia korzystają z wypłaty 75%. Historyczne wyniki nie są przeliczane.
