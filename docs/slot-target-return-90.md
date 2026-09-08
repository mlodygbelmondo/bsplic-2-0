# Cel zwrotu slotów: około 90%

Raport historyczny, sprzed [wydłużenia bonusu do 15 mniejszych obrotów](slot-bonus-autoplay.md). Nie opisuje zwrotu po zastosowaniu migracji `20260908160000_slot_bonus_autoplay.sql`.

Migracja `20260908150000_slot_target_return_90.sql` ustawia osobny współczynnik wypłat dla każdej gry. Mnożniki, losowanie symboli, 10 darmowych obrotów i limit ×200 pozostają bez zmian.

## Kalibracja

Rzeczywisty RPC PostgreSQL w izolowanej bazie, stawka 10. 200 000 płatnych obrotów na grę plus wszystkie zdobyte darmowe obroty. Ziarno generatora testowego: 0.271828. Produkcyjny generator pgcrypto nie jest modyfikowany.

Nowa baza = poprzednia baza × 90 / zmierzony procent zwrotu, zaokrąglona do czterech miejsc po przecinku.

| Gra | Zmierzony zwrot poprzedniej bazy | Poprzednia baza | Nowa baza |
| --- | ---: | ---: | ---: |
| Midnight Bandit | 77,18% | 2,20 | 2,5654 |
| Candy Cascade | 76,75% | 0,18 | 0,2111 |
| Ember Forge | 78,20% | 2,20 | 2,5320 |
| Pearl Tide | 76,84% | 0,18 | 0,2108 |

## Niezależna walidacja

100 000 dodatkowych płatnych obrotów na grę, wraz z darmowymi obrotami, ziarno −0.618034. Tych wyników nie używano do ponownego dostrajania współczynników. Łącznie wykonano 1 200 000 płatnych obrotów oraz dodatkowe darmowe obroty.

| Gra | Zwrot | Orientacyjny margines 95% | Płatne obroty z zyskiem | Serie 10 rund na plusie |
| --- | ---: | ---: | ---: | ---: |
| Midnight Bandit | 88,71% | ±1,82 pp | 12,64% | 34,39% |
| Candy Cascade | 91,49% | ±1,29 pp | 24,12% | 37,30% |
| Ember Forge | 88,57% | ±1,85 pp | 12,64% | 34,48% |
| Pearl Tide | 91,11% | ±1,22 pp | 26,71% | 36,98% |

90% jest celem długoterminowym oszacowanym symulacyjnie, a nie dokładnie udowodnionym RTP ani gwarancją wyniku pojedynczej sesji. Margines jest przybliżeniem normalnym z wariancji wypłaty pełnej rundy z darmowymi obrotami. Dochodzi niepewność estymacji współczynników na próbce kalibracyjnej. Kwoty są zaokrąglane do 0,01 przed mnożnikami.

Lucky shot po sześciogodzinnej przerwie nie występuje w ciągłej symulacji. Jest dodatkowym bonusem poza celem 90%; jego wkład do całkowitego zwrotu zależy od częstotliwości przerw oraz stawek pierwszych obrotów po przerwie.

## Powtórzenie walidacji aktualnej wersji

```bash
SLOT_SIMULATE=1 SLOT_SIMULATION_SPINS=100000 SLOT_SIMULATION_SEED=-0.618034 bash scripts/test-casino-slots.sh
```

Bazowy pomiar wykonano na funkcji z migracji `20260908140000_reduced_slot_payouts.sql`, przed zastosowaniem nowej migracji, z 200000 obrotów i ziarnem 0.271828. Każda gra resetuje ziarno. Generator testowy jest przywracany po pomiarze, a cały lokalny klaster jest usuwany przez runner.

Testy obejmują kwoty wypłat i zaokrąglenia przy stawkach 1, 5 i 100, oba krańce tabel symboli, mnożniki, saldo, bonusy oraz równoczesne żądania. Testy frontendu slotów: 9. Testy przeglądarkowe: 14. Lint bez błędów, 16 istniejących ostrzeżeń. Build poprawny.
