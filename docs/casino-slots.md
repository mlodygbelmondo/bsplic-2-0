# Sloty BSPLIC

Cztery autorskie gry na wspólną wirtualną walutę: Midnight Bandit, Candy Cascade, Ember Forge i Pearl Tide. Nawiązują do mechanik cluster pays i pay anywhere. Nie są portami Le Bandit ani Sweet Bonanza i nie odtwarzają pełnych tabel wypłat ani wszystkich funkcji tych produktów. Grafiki są własne, wygenerowane przez wbudowany imagegen.

## Uruchomienie

Frontend używa `/casino/slots/bandit`, `/casino/slots/candy`, `/casino/slots/ember` i `/casino/slots/tide`. Mobilna zakładka „Gry” prowadzi do `/casino`, zawierającego również ruletkę i blackjacka.

Migracje `20260907090000_casino_slots.sql` i `20260907180000_fix_casino_slot_state.sql` wdrożono 7 września 2026 do projektu Supabase `bsplic 2.0` (`imucpqgglvarpoezhbdb`). Druga migracja usuwa konflikt nazwy zmiennej z kolumną przy odczycie historii. Na istniejącym koncie testowym sprawdzono obie gry: odczyt stanu, obrót ze stawką 1, rozliczenie portfela, idempotentne ponowienie oraz zapis historii. Poza istniejącym kontem testowym nie zmieniano danych graczy.

Przy kolejnych operacjach CLI należy wybrać token konta mającego dostęp do BSPLIC. Na tym Macu helper `sbsw` jest nieobecny; wdrożenie użyło `SUPABASE_ACCESS_TOKEN` przekazanego wyłącznie do środowiska procesu. Token nie trafił do repozytorium.

Nie ma zmian zależności aplikacji. Trasa i CSS slotów są ładowane leniwie.

## Zmiany oczekujące na wdrożenie

`20260907200000_recurring_slot_boost.sql` oraz `20260908090000_more_slots_player_odds.sql` oczekują na wdrożenie. Przed publikacją nowego frontendu należy zastosować obie migracje w Supabase. Istniejące konta otrzymają nową losową pulę przy pierwszym odczycie stanu lub obrocie po migracji; historia i saldo pozostają bez zmian. Testy lokalne obejmują granice puli i czasu, wspólny licznik, darmowe obroty, odnowienie po przerwie oraz równoczesne ponowienia ostatniego obrotu bonusowego.

## Mechanika i rozliczenia

- Plansza 6 × 5. Bandit wymaga co najmniej pięciu jednakowych symboli połączonych bokami. Candy wymaga ośmiu w dowolnych miejscach.
- Wygrywające symbole znikają, pozostałe opadają w kolumnach, nowe są losowane u góry. Maksymalnie 12 układów na obrót, maksymalna wypłata 500 × stawka.
- Bandit zwiększa mnożniki wygrywających pól do 5×. Grupa używa najwyższego mnożnika swoich pól. Pola zerują się przy nowym obrocie. Wskaźnik planszy pokazuje najwyższy zastosowany mnożnik.
- Candy losuje wspólny mnożnik 1–5× dla każdej wygrywającej kaskady.
- Ember wymaga 5 sąsiadujących symboli i zwiększa mnożnik całej kaskady od ×1 do ×5; nowy obrót resetuje mnożnik.
- Tide wymaga 8 symboli w dowolnych miejscach i zawsze używa ×3.
- Cztery symbole BONUS na pierwszej planszy płatnego obrotu przyznają osiem darmowych obrotów, ze stawką utrwaloną w bazie. Darmowe obroty nie przyznają następnych bonusów.
- Bonus obejmuje losowe 5–15 płatnych obrotów na koncie, wspólnych dla obu gier. Każdy ma 90% szansy wstawienia grupy dającej zysk netto. Po zużyciu bonusu każdy płatny obrót ma 60% szans na taką grupę. Pozostałe losowania mogą wygrać naturalnie. Grupa ma 5 symboli dla Bandit/Ember i 13 dla Candy/Tide. Dla Candy/Tide nawet najtańszy symbol płaci przed mnożnikiem `0.23 × 1.35^5 ≈ 1.0313 × stawka`, więc także najniższy mnożnik daje dodatni wynik po zaokrągleniu. Darmowe obroty nie dostają dodatkowej grupy. Po zużyciu ostatniego obrotu serwer losuje przerwę 12–36 godzin. Po jej upływie kolejny odczyt stanu lub obrót aktywuje nową pulę. Niewykorzystana pula nie wygasa, nie kumuluje się i nie jest zużywana przez darmowe obroty. Odświeżenie, zmiana gry i wylogowanie nie zmieniają losowania.
- Losowanie używa `pgcrypto.gen_random_bytes`. BONUS ma prawdopodobieństwo 2,5% na pole; każdy pozostały symbol 97,5% / 7. Minimalna grupa płaci `stake × base × (1 + symbol × 0.25)`, gdzie base to 2.60 dla Bandit/Ember i 0.23 dla Candy/Tide. Każdy dodatkowy symbol zwiększa bazową wypłatę 1.35×. Zaokrąglenie do grosza następuje przed mnożnikiem.
- Historyczny pomiar sprzed zmiany szans (nie opisuje obecnej wersji): próbka po 20 tys. obrotów na grę, ze stawką 10 i wyłączonym bonusem powitalnym, dała obserwowany zwrot 93,61% w Bandicie i 99,88% w Candy. To wynik losowej próbki, nie dokładne RTP ani gwarancja. Próbka obejmowała darmowe obroty.
- Serwer sprawdza użytkownika, stawkę 1–100, saldo i stawkę bonusu. Blokada wiersza profilu serializuje operacje portfela. Wynik, bonus i saldo są zapisywane w jednej transakcji.
- UUID żądania zapewnia idempotencję, również przy równoczesnych żądaniach. Nierozstrzygnięte żądanie pozostaje w localStorage pod kluczem użytkownika i gry. Ponowienie po błędzie używa tego samego UUID i stawki.
- RLS udostępnia historię i bonusy tylko właścicielowi. Klient nie może pisać bezpośrednio do tabel ani wywoływać wewnętrznych funkcji losujących.
- Wypłata i wynik netto są prezentowane oddzielnie. Dźwięk jest domyślnie wyłączony; dodatni sygnał jest zarezerwowany dla dodatniego wyniku netto. System ograniczenia animacji jest respektowany.

Historia slotów jest dostępna wewnątrz gier; istniejące zestawienia historii i rankingów ruletki/blackjacka nie zostały rozszerzone. „Ta sesja” liczy grę od wejścia na ekran, a trwała historia zawiera ostatnie dziesięć obrotów. Przycisk zakończenia blokuje obroty w bieżącej sesji.

## Weryfikacja

```bash
# Node 26 udostępnia eksperymentalny webstorage kolidujący z jsdom.
NODE_OPTIONS=--no-experimental-webstorage npm run test
npm run lint
npm run perf:build
npx playwright test --config playwright.slots.config.ts
bash scripts/test-casino-slots.sh
```

Testy SQL uruchamiają własny tymczasowy klaster PostgreSQL przez lokalny socket, nie czytają poświadczeń aplikacji i usuwają klaster po wykonaniu. Wymagają `initdb`, `pg_ctl`, `psql` oraz pgcrypto. Obejmują grupy i granice planszy, walidację, portfel, ponowienia, równoległość, bonusy, limit wypłat oraz RLS.

Playwright uruchamia lokalny Vite z fikcyjnym adresem Supabase i kontrolowanymi odpowiedziami HTTP. Testuje prawdziwe komponenty w Chromium i WebKit, bez zapisów do usług produkcyjnych. Sprawdza również przycisk obrotu nad dolnym paskiem telefonu oraz ponowienie po błędzie i przeładowaniu strony.

Pełny zestaw Vitest: 127 plików, 883 testy. Testy przeglądarkowe: 14 scenariuszy przeszło w Chromium i WebKit, w tym ekran 320 × 568. Lint: brak błędów, istniejące ostrzeżenia. Pełny `tsc -p tsconfig.app.json --noEmit` zgłasza istniejące błędy poza modułem slotów. Nie poprawiano ich w tej zmianie.

Pomiar przed zmianą: największy JS 468.1 kB / 137.2 kB gzip. Po dodaniu slotów: około 468.6 kB / 137.4 kB gzip; osobny kod ekranu slotów około 16 kB / 6.6 kB gzip. Grafiki mają łącznie około 970 kB i nie są pobierane na ekranie logowania.

## Grafiki i prompty

Wbudowany imagegen, bez Blendera i bez zewnętrznego API. Źródłowe PNG pozostają w katalogu wygenerowanych obrazów Codex. W projekcie zapisano WebP pod `public/casino/slots/`.

### bandit.webp

> Use case: stylized-concept. Create a premium mobile slot game background illustration, portrait 1024x1536. Original character: mischievous raccoon jewel thief wearing a tiny forest-green flat cap and dark velvet waistcoat, holding a golden key, on the lower right edge of a moonlit old European rooftop. Emerald green atmosphere, warm gold lanterns, coins, intricate stone arches, soft cinematic depth, polished high-end 3D animated film art, exquisite fur and metal materials. Composition: decorative arched frame around a dark empty central area that will hold a 5x5 game board, generous dark negative space in central 65 percent, raccoon outside this area in bottom right corner. No UI, no text, no logos, no reel symbols, no watermark. Landscape details subtle and atmospheric. Asset for an original virtual-currency casino game called Midnight Bandit.

### candy.webp

> Use case: stylized-concept. Asset: portrait 1024x1536 background for an original premium mobile candy slot game Sugar Rush. Lavish whimsical candy kingdom rendered as polished 3D animated movie art. Pink strawberry clouds, glossy oversized lollipops and candy canes at outer edges, mint and raspberry confectionery hills, soft aqua sky, peach sunset glow, glazed jelly sweets, detailed sugar crystals. An ornamental creamy golden arch around a spacious dark plum central area reserved for a game board. Keep central 65 percent relatively empty and uncluttered. Rich tactile materials, cinematic volumetric lighting, vibrant pink peach aqua palette, remarkable depth, no UI, no text, no logos, no watermark, no reel symbols.

Nazwa robocza w prompcie nie jest używana w aplikacji; finalna nazwa to Candy Cascade.

### symbols.webp

> Create a production game sprite atlas, exactly 4 columns by 4 rows on a square 1024x1024 image. Each of the 16 equal 256x256 cells contains one isolated centered highly polished 3D slot symbol on a uniform deep black background. Plenty of padding within each cell, no symbol touching boundaries, consistent size and frontal perspective. No text or numbers. Top row: emerald gemstone, golden coin with star engraving, ruby jewel, sapphire jewel. Second row: purple velvet money bag, ornate golden key, golden crown with emerald, raccoon thief face with green cap. Third row: pink jelly heart, red striped round candy, aqua diamond candy, purple grapes. Fourth row: yellow banana bunch, red watermelon wedge, green apple, pink spiral lollipop. Jewel thief symbols top half, candy symbols bottom half. Exquisite bevels, rich specular highlights, saturated colors, tactile 3D rendering. Perfect regular aligned sprite sheet without lines or separators.

## Grafiki nowych slotów

Ember Forge: bazaltowa kuźnia z miedzianym łukiem, lawą i smokiem. Pearl Tide: podwodny pałac z perłowym łukiem. Osobny atlas 16 symboli kuźni i oceanu. Wszystkie trzy grafiki wygenerowane przez imagegen, zapisane jako WebP w `public/casino/slots/`.

Weryfikacja nowej migracji: izolowane testy PostgreSQL potwierdzają granice 60%/90%, dodatni wynik przy minimalnej stawce, historię, ponowienia i mnożniki obu nowych gier. Dry-run Supabase wskazuje wyłącznie dwie oczekujące migracje wymienione powyżej; token ma dostęp do właściwego projektu.
