# Kalibracja wypłat slotów, 8 września 2026

Wdrożona migracja: `20260908140000_reduced_slot_payouts.sql`.
Baza wypłat Bandit/Ember spada z 2,60 do 2,20 (−15,38%). Candy/Tide: z 0,21 do 0,18 (−14,29%). Losowanie symboli, dziesięć darmowych obrotów, mechaniki mnożników i lucky shot nie zmieniają się.

## Metoda

20 000 płatnych obrotów na grę i wersję, stawka 10. Łącznie 160 000 płatnych obrotów, dodatkowo wszystkie przyznane darmowe obroty. Uruchomiono rzeczywisty RPC PostgreSQL w izolowanych, usuwanych bazach lokalnych. Wyłącznie na czas symulacji kryptograficzny generator zastępuje równomierny `random()` z `setseed(0.314159)`; przed i po zmianie każda gra używa tego samego ciągu. Transakcje są zatwierdzane co 250 płatnych rund, aby pomiar nie zwalniał przez narastające wersje wierszy. Funkcja generatora jest przywracana po pomiarze. Kod produkcyjny nadal używa pgcrypto.

Zwrot oznacza sumę wszystkich wypłat, również z darmowych obrotów, podzieloną przez pobrane stawki. Zysk z płatnego obrotu oznacza wypłatę większą od stawki w tym obrocie. Seria to 10 płatnych obrotów wraz z przypisanymi darmowymi obrotami. Lucky shot jest wyłączony z pomiaru przez brak sześciogodzinnych przerw między obrotami; jego wpływ zależy od rzeczywistego rytmu gry.

## Wyniki

| Gra | Zwrot przed | Zwrot po | Płatne obroty z zyskiem przed | Po |
| --- | ---: | ---: | ---: | ---: |
| Midnight Bandit | 88,85% | 75,19% | 12,47% | 12,47% |
| Candy Cascade | 93,70% | 80,29% | 24,65% | 22,74% |
| Ember Forge | 89,93% | 76,10% | 12,47% | 12,47% |
| Pearl Tide | 92,71% | 79,45% | 26,75% | 24,07% |

| Gra | Serie 10 rund z zyskiem przed | Po | Orientacyjny margines 95% dla zwrotu po |
| --- | ---: | ---: | ---: |
| Midnight Bandit | 34,25% | 27,80% | ±3,57 pp |
| Candy Cascade | 37,10% | 29,90% | ±2,48 pp |
| Ember Forge | 34,40% | 28,05% | ±3,66 pp |
| Pearl Tide | 38,20% | 29,45% | ±2,39 pp |

To wyniki powtarzalnej próbki, nie dokładne teoretyczne RTP. Margines jest przybliżeniem normalnym z wariancji wypłat pełnych płatnych rund wraz z bonusami. Rzadkie duże wypłaty ograniczają dokładność oszacowania. W Bandicie i Emberze zmniejszenie bazy nie zmienia częstości trafienia grupy; w tej próbce każde takie trafienie nadal przewyższało stawkę.

## Odtworzenie

```bash
SLOT_SIMULATE=1 SLOT_SIMULATION_BASELINE=1 bash scripts/test-casino-slots.sh
SLOT_SIMULATE=1 bash scripts/test-casino-slots.sh
```

Runner tworzy własny PostgreSQL na lokalnym sockecie, stosuje migracje i testy kontraktowe, a po zakończeniu usuwa bazę. Wariant baseline przywraca wyłącznie w bazie testowej wcześniejszą funkcję wypłat, a po pomiarze ponownie stosuje nową.

## Weryfikacja wdrożenia

Migracja zastosowana na Supabase `bsplic 2.0`. Testy SQL i 9 testów frontendu slotów przeszły. Build poprawny, lint bez błędów (16 dotychczasowych ostrzeżeń). Produkcyjne sprawdzenie czterech gier potwierdziło stan, obrót, saldo, powtórzenie żądania i historię. Vercel potwierdził wdrożenie commita `f558554`.
