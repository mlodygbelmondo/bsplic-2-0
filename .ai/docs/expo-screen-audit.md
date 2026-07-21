# Expo screen audit

Ostatnia aktualizacja: 2026-07-21
Referencja: produkcyjny PWA przy mobilnym viewportcie oraz `.ai/docs/expo-migration-contract.md`.

Statusy w tym pliku są dowodami ekran-po-ekranie. Status obszaru w `expo-migration-status.md` nie zastępuje przejścia poniższej macierzy.

## Kryteria wspólne

Każdy ekran jest oceniany w zakresie, który ma zastosowanie: dark/light, iPhone 17 Pro, loading, dane, empty, error, offline, focus/resume, rola, nawigacja wstecz, safe area, klawiatura, scroll i dolny dock. `complete` wymaga renderu na iOS albo wiarygodnego testu dla stanu, którego nie da się bezpiecznie wymusić.

## Macierz ekranów i stanów

| # | Powierzchnia | Stany wymagane | Status | Dowód / defekt |
|---|---|---|---|---|
| 1 | Splash / app loader | cold start, font failure fallback | pending | |
| 2 | Login | dark, light, keyboard, invalid credentials, offline | pending | |
| 3 | Reset hasła | deep link, invalid/expired recovery, success | pending | |
| 4 | Brak profilu po auth | retry, logout | pending | |
| 5 | Shell / header | dark, light, saldo, unread, profile, menu | partial | Dark/light, saldo, unread i akcje porównane; dodano brakujący link logo → Zakłady. Wymaga jeszcze stanu bez profilu i regresji focus/resume. |
| 6 | Dolny dock | 5 tabów, selected, scroll-hide, safe area, casino tone | partial | 5 tabów, safe area, casino tone oraz brak fałszywego selected na lobby/profilu potwierdzone; przywrócono dock na profilach i detailu Social jak w PWA. Wymaga scroll-hide. |
| 7 | Menu użytkownika | profil, top-up available/used, transfer, notifications, admin gate, theme, logout | partial | Dark/light i akcje porównane, dodano brakujące wejście Kasyno; wymagany admin gate i stan zużytego top-upu. |
| 8 | Notifications sheet | loading, unread/read, empty, sound, deep link | pending | |
| 9 | Transfer sheet | search, selection, validation, history, empty, offline, keyboard | partial | Light/empty i układ formularza zweryfikowane na iOS; wymagane wyszukiwanie, validation, historia, offline i klawiatura. |
| 10 | Maintenance | checking, active, retry | pending | |
| 11 | Connectivity banner | offline cache, reconnect, writes disabled | pending | |
| 12 | Sportsbook home | dark, light, loading, error, empty, data, pagination, realtime | pending | |
| 13 | Sportsbook filters | sorting, category, active/in-progress | pending | |
| 14 | Bet card | compact/expanded, selection, closed/in-progress | pending | |
| 15 | Jackpot home card | eligible/ineligible, ticket state, draw link | partial | Collecting i rolled-over zweryfikowane side-by-side; naprawiono zły asset tła, hero amount, countdown/statusy, note rollover, info i blokady CTA. Wymaga fixtures limit/insufficient/locked/drawn bez ticketu. |
| 16 | Coupon | empty, single, AKO, exclusion, stake, validation, offline, copied Social coupon | partial | Pusty kupon dark zweryfikowany przez deep link; kod obejmuje Single/AKO, precision, balance, exclusions i offline, ale wymagane są bezpieczne fixture/testy stanów z pozycjami. |
| 17 | Propose bet | form, validation, submit error/success, offline, keyboard | pending | |
| 18 | Social feed | dark, light, loading, empty, error, filters, realtime | partial | Light/data/filtry porównane side-by-side; nadal wymagane dark oraz stany loading/empty/error/realtime. |
| 19 | Social stories | empty, data, navigation | partial | Naprawiono brak fallbacków profili przy pustych aktywnych relacjach i potwierdzono render/linki na iOS; nadal wymagany viewer aktywnej relacji. |
| 20 | Social composer | post/image, mentions, Eniu, draft persistence, offline, keyboard | pending | |
| 21 | Social feed card | post/coupon/casino, image, YouTube, Spotify, reactions, share, copy coupon | pending | |
| 22 | Comments / threads | empty, nested, add, reaction, reactor list, offline | pending | |
| 23 | Social detail deep link | post/coupon/casino, missing/deleted | pending | |
| 24 | Own profile | dark, light, loading, error, player card, stats, badges, histories, avatar actions | partial | Side-by-side dark/light: naprawiono kontrast karty gracza, pełny katalog zablokowanych odznak i dock/link home. Wymaga historii z danymi, uploadu oraz wymuszonych error/loading. |
| 25 | Public profile | data, RLS-safe history, share, missing user | partial | Profil St1Cku porównany side-by-side: statystyki i RLS-safe empty history zgodne; naprawiono pełne karty odznak, copy oraz daty odblokowania. Wymaga share i missing user. |
| 26 | Rankings | dark, light, sportsbook/casino, metrics, sorting, loading, empty, error | partial | Side-by-side dark/light: sportsbook/casino oraz profit/win rate zgodne 1:1, w tym self-row i profile links. Wymagane wymuszone empty/error. |
| 27 | Casino lobby | cards, navigation, scroll, casino dock | complete | Side-by-side PWA/iOS 402 px: karty, copy, tło, scroll i dock; dodano brakujące wejście „Kasyno” do menu i usunięto fałszywy selected tab lobby. |
| 28 | Roulette table | idle/waiting/spinning/settled, participants, wins, my bets, result | partial | Ponowny side-by-side wykazał błędne „ostatnie spiny”, status i drawer; poprawione, wymaga regresji stanów dynamicznych. |
| 29 | Roulette stake drawer | collapsed/open, all bet types, validation, queue-next-round, offline, keyboard | partial | Geometria, typ domyślny i queue-next-round poprawione; wymagane końcowe screenshoty open/closed. |
| 30 | Blackjack betting | loading, quick stakes, validation, offline | partial | Rozszerzono presety i układ względem PWA; wymaga screenshotu bez aktywnej gry. |
| 31 | Blackjack game | playing, insurance, hit/stand/double/split, multi-hand, reveal, settled | partial | Otwarty stół, prawidłowy rewers, hierarchia i CTA poprawione side-by-side dla aktywnego splitu; pozostałe stany wymagają testu/renderu. |
| 32 | Jackpot draw | loading, unavailable, draw, suspended/resume, claim, claimed, error | partial | Rolled-over iOS naprawiony według PWA: usunięto rozciągnięty stage użyty jako tło, użyto poprawnego mobile backgroundu, dodano back/hero/meta i semantykę „Brak losowania”. Wymagane normal reveal/winner/claim/claimed fixtures. |
| 33 | Bonus campaign overlay | eligible/ineligible, claim, failure, offline | pending | |
| 34 | Feature poll overlay | mandatory, optional, submit failure/success, offline | pending | |
| 35 | Admin shell | admin, moderator, denied, offline, tab navigation | pending | |
| 36 | Admin dashboard | loading, data, error | pending | |
| 37 | Admin manage bets | filters, pagination, settle/refund confirmation/errors | pending | |
| 38 | Admin create bet | fields, options, validation, submit | pending | |
| 39 | Admin proposals | list, source badges, approve/reject flows | pending | |
| 40 | Admin categories | list, create/edit validation | pending | |
| 41 | Admin Eniu | settings/actions/errors | pending | |
| 42 | Admin bonus campaigns | list, form, state transitions | pending | |
| 43 | Admin feature polls | list, form, state transitions | pending | |
| 44 | Unknown/deep-link fallback | unsupported path, web fallback | complete | Zastąpiono surowy „Unmatched Route” własnym ekranem BSPLIC; iOS deep link potwierdza home CTA, production-web fallback i dock bez fałszywego selected. |

## Sąsiednie powierzchnie regresyjne

- Root PWA pozostaje bez zmian wizualnych i funkcjonalnych.
- Powierzchnie niewidoczne w stosie Expo nie mogą wykonywać fetchy, realtime, audio ani animacji.
- Zmiany komponentów wspólnych są sprawdzane co najmniej na jednym ekranie casino i jednym nie-casino.
