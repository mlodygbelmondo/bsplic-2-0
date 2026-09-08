# Grafiki i mobilne sterowanie kasyna

Cztery nowe grafiki wygenerowano wbudowanym narzędziem `image_gen`. Oryginalne PNG pozostają w katalogu wygenerowanych obrazów Codex. W aplikacji używane są pliki WebP, jakość 82; razem około 737 kB. Okładki są ładowane leniwie, tła tylko na ekranie danej gry.

## Pliki

- `public/casino/roulette-cover.webp`
- `public/casino/blackjack-cover.webp`
- `public/casino/roulette-table.webp`
- `public/casino/blackjack-table.webp`

## Prompty

### roulette-cover

Use case: stylized-concept. Asset type: casino game selection cover, landscape 1536x1024. Create premium cinematic 3D game key art of a European roulette wheel, luxurious dark polished walnut and brushed brass spindle, carefully crafted red and black pockets and a single green zero pocket, ivory ball, a few substantial emerald green and gold casino chips. Strong recognizable wheel silhouette centered in upper two thirds, close low three-quarter camera. Emerald-lit private casino room in soft focus, rich warm gold rim lighting, tactile surfaces, sophisticated rendered game art with the finish of a high quality slot game cover. Keep lower quarter dark and visually quiet for real UI text overlay. No people, no floating coins, no lettering, no title, no logo, no watermark. Full-bleed artwork, no frame.

### blackjack-cover

Use case: stylized-concept. Asset type: casino game selection cover, landscape 1536x1024. Create premium cinematic 3D game key art for blackjack. Two beautifully rendered ivory playing cards, ace of spades and king of hearts, slightly fanned, resting upright at a diagonal against a short stack of garnet red and brass-edged casino chips on deep burgundy felt. Accurate traditional recognizable card faces. Dark walnut casino room softly out of focus. Strong central silhouette in upper two thirds, warm gold rim light and subtle ruby highlights, fine paper grain, engraved chips, rich tactile polished game art with the finish of a high quality slot game cover. Keep lower quarter dark and quiet for real UI title overlay. No people, no flying coins, no title, no logo, no watermark. Full bleed, no frame.

### roulette-table

Use case: stylized-concept. Asset type: background for a mobile roulette game, portrait 1024x1536. Premium cinematic casino game environment, a dark emerald green felt table filling the central 75 percent, subtle real woven felt texture, curved polished walnut and fine brass table rail along outer lower corners, softly glowing green-shaded brass casino lamps barely visible in the far upper corners, moody dim emerald private room. Camera looks down toward the table. Dark calm empty center for a real interactive roulette wheel and controls added by software. Beautiful material realism with stylized 3D game polish. Edge details provide atmosphere, center has no focal objects. No roulette wheel, no chips in center, no playing cards, no people, no text, no symbols, no UI, no watermark.

### blackjack-table

Use case: stylized-concept. Asset type: background for a mobile blackjack game, portrait 1024x1536. Premium cinematic casino game environment, a dark burgundy felt card table filling the central 75 percent, fine real woven felt texture, curved dark walnut rail with thin brass inlay along outer lower corners, a few neatly stacked muted garnet and ivory chips only at the far upper right edge, dim warm gold casino room glow beyond the table. Camera looks down toward the felt. Calm dark empty center reserved for real playing cards and controls rendered by software. Rich material realism and sophisticated stylized 3D game polish, matching a premium slot game's atmosphere. No playing cards, no wheel, no people, no text, no labels, no UI, no watermark.

## Sterowanie

Ruletka pokazuje wybór zakładu bezpośrednio pod kołem. Dolny pasek zawiera stawkę, wybrany zakład i przycisk postawienia. Okno stawki korzysta z istniejącego Sheet z obsługą fokusu i zamykania; zmiana kwoty nie wysyła zakładu.

Blackjack układa na telefonie karty przed decyzjami, a decyzje utrzymuje nad dolną nawigacją. Dobierz i Pas są w pierwszym rzędzie, Podziel i Podwój poniżej, gdy są dostępne. Przyciski mają co najmniej 44 px wysokości. Dodatkowe przeliczniki stawki są rozwijane. Nie zmieniono reguł, wypłat ani API gier.

## Sprawdzenie

`npx playwright test --config playwright.casino.config.ts` sprawdza Chromium na komputerze i ekranie 320 × 568 oraz WebKit na iPhonie. Używa kontrolowanych odpowiedzi HTTP, bez zapisów do produkcyjnych kont. Zrzuty zapisuje pod `test-results/casino-mobile/`.


Weryfikacja 8 września 2026: 76 testów Vitest i 13 scenariuszy Playwright przeszło. Dwa scenariusze wyłącznie mobilne są pomijane w projekcie desktopowym. Lint: 0 błędów, 16 istniejących ostrzeżeń. Build poprawny. Największy JS: 468,6 → 468,7 kB; gzip pozostaje 137,4 kB. Łączny JS: 1448,8 → 1438,2 kB. Dodatkowy CSS niskich ekranów jest ładowany z trasą blackjacka.
