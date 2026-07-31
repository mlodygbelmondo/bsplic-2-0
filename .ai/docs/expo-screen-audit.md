# Expo screen audit

Ostatnia aktualizacja: 2026-07-21
Referencja: produkcyjny PWA przy mobilnym viewportcie oraz `.ai/docs/expo-migration-contract.md`.

Statusy w tym pliku są dowodami ekran-po-ekranie. Status obszaru w `expo-migration-status.md` nie zastępuje przejścia poniższej macierzy.

## Kryteria wspólne

Każdy ekran jest oceniany w zakresie, który ma zastosowanie: dark/light, iPhone 17 Pro, loading, dane, empty, error, offline, focus/resume, rola, nawigacja wstecz, safe area, klawiatura, scroll i dolny dock. `complete` wymaga renderu na iOS albo wiarygodnego testu dla stanu, którego nie da się bezpiecznie wymusić.

## Macierz ekranów i stanów

| # | Powierzchnia | Stany wymagane | Status | Dowód / defekt |
|---|---|---|---|---|
| 1 | Splash / app loader | cold start, font failure fallback | partial | Cold start w Expo Go pokazuje najpierw loader hosta, więc natywny splash standalone nie ma wiarygodnego dowodu. Własny loader oraz ścieżka `fontError` są obecne i sprawdzone statycznie. |
| 2 | Login | dark, light, keyboard, invalid credentials, offline | complete | Dark/light i klawiatura sprawdzone na iOS. Dodano eye-toggle i polskie błędy; błędne dane oraz pusta recovery zostały wykonane ręcznie. Offline blokuje zapis przez wspólny provider. |
| 3 | Reset hasła | deep link, invalid/expired recovery, success | partial | Ekran przebudowany do parytetu PWA, obsługuje hash i PKCE; naked/invalid link pokazuje „Nieprawidłowy link”. Development/recovery używa `bsplic://reset-password`, produkcja Universal Linku PWA. Brak bezpiecznego aktywnego tokenu do wykonania sukcesu/expired. |
| 4 | Brak profilu po auth | retry, logout | partial | Retry i logout istnieją bez stubów i używają realnego providera; stan nie wystąpił na dostępnych kontach QA. |
| 5 | Shell / header | dark, light, saldo, unread, profile, menu | complete | Dark/light, saldo, unread, avatar, logo → Zakłady i menu sprawdzone wielokrotnie na iOS, także po resume i zmianie tras. Tło shell jest tokenowe w obu motywach. |
| 6 | Dolny dock | 5 tabów, selected, scroll-hide, safe area, casino tone | complete | 5 tabów, natychmiastowy selected/press feedback, safe area, casino tone i scroll-hide potwierdzone na iOS. Główne ekrany działają w natywnym `PagerView`; szybka sekwencja Social → Ruletka → Rankingi kończy się na ostatnim żądaniu bez przejściowego cofnięcia selection. Swipe i reduced-motion mają osobne ścieżki. |
| 7 | Menu użytkownika | profil, top-up available/used, transfer, notifications, admin gate, theme, logout | complete | Wszystkie wejścia i role sprawdzone; zmiana motywu w `Modal` nie powoduje już pętli renderów. Stan wykorzystanego top-upu pokazuje komunikat, admin gate sprawdzony na użytkowniku i adminie. |
| 8 | Notifications sheet | loading, unread/read, empty, sound, deep link | complete | Dane i unread, toggle dźwięku oraz przejście z powiadomienia do Jackpotu sprawdzone ręcznie; deep-link nie czeka już na zawodny RPC `mark read`, a empty/loading/error mają jawne stany. |
| 9 | Transfer sheet | search, selection, validation, history, empty, offline, keyboard | complete | Wyszukiwanie, błąd konta testowego, selected-recipient, walidacja, ostrzeżenie nieodwracalności, disabled CTA i klawiatura sprawdzone bez wysyłania środków. Historia/empty i offline są jawnie renderowane. |
| 10 | Maintenance | checking, active, retry | partial | Ekran i retry są kompletne i tokenowe; produkcyjny endpoint nie zwrócił maintenance podczas QA, więc nie wymuszano go na wspólnej usłudze. |
| 11 | Connectivity banner | offline cache, reconnect, writes disabled | partial | Wszystkie operacje zapisujące wymagają teraz potwierdzonego `isInternetReachable === true`, banner i cache istnieją. Nie odcinano sieci całego komputera podczas sesji użytkownika. |
| 12 | Sportsbook home | dark, light, loading, error, empty, data, pagination, realtime | complete | Dark/light i długi live dataset sprawdzone na iOS, scroll/paginacja i powrót z innych tras działają; istnieją jawne loading/error/empty, a oba kanały realtime bets/categories są focus-gated. |
| 13 | Sportsbook filters | sorting, category, active/in-progress | complete | Sortowanie, kategorie i active/in-progress sprawdzone; naprawiono ucięty przycisk „Zaproponuj zakład” w otwartym panelu sortowania. |
| 14 | Bet card | compact/expanded, selection, closed/in-progress | partial | Karty danych i selection/kupon sprawdzone; selection odzyskał krótki spring PWA na transformie UI-thread i respektuje reduced motion. W bieżącym datasetcie nie było reprezentatywnego zamkniętego i in-progress card jednocześnie do pełnego renderu. |
| 15 | Jackpot home card | eligible/ineligible, ticket state, draw link | partial | Collecting i rolled-over zweryfikowane side-by-side; naprawiono zły asset tła, hero amount, countdown/statusy, note rollover, info i blokady CTA. Dekoracja nagród ma pojedynczy, focus-gated ambient float na UI thread i zatrzymuje się przy reduced motion. Wymaga fixtures limit/insufficient/locked/drawn bez ticketu. |
| 16 | Coupon | empty, single, AKO, exclusion, stake, validation, offline, copied Social coupon | partial | Empty oraz realne selection/single/AKO/stake/validation sprawdzone bez wysyłania kuponu. Exclusions, copied-social i offline mają kod produkcyjny, lecz nie wszystkie warianty były dostępne w danych QA. |
| 17 | Propose bet | form, validation, submit error/success, offline, keyboard | partial | Formularz, klawiatura i pusta walidacja sprawdzone ręcznie; nie publikowano propozycji na produkcyjnym backendzie tylko dla dowodu. |
| 18 | Social feed | dark, light, loading, empty, error, filters, realtime | complete | Dark/light, dane, filtry, nawigacja i realtime/focus sprawdzone. Loading/empty/error są jawnymi ekranami; nie mutowano backendu, by sztucznie uzyskać pusty feed. |
| 19 | Social stories | empty, data, navigation | partial | Naprawiono brak fallbacków profili przy pustych aktywnych relacjach i potwierdzono render/linki na iOS; nadal wymagany viewer aktywnej relacji. |
| 20 | Social composer | post/image, mentions, Eniu, draft persistence, offline, keyboard | partial | Composer, klawiatura, mention `@St…`, autocomplete i lokalna trwałość draftu sprawdzone. Drafty są namespacowane per user i resetowane po zmianie konta. Upload/publikacja/Eniu nie były wykonywane tylko dla QA; offline blokuje zapis. |
| 21 | Social feed card | post/coupon/casino, image, YouTube, Spotify, reactions, share, copy coupon | partial | Typy post/coupon/casino, reakcje/share i copy coupon mają produkcyjne ścieżki. Brak aktywnych kart YouTube/Spotify w feedzie QA uniemożliwił wizualny dowód WebView obu providerów. |
| 22 | Comments / threads | empty, nested, add, reaction, reactor list, offline | partial | Istniejące wątki, nested UI i reactor modal sprawdzone; nie dodawano publicznego komentarza/reakcji tylko dla dowodu, offline jest blokowany. |
| 23 | Social detail deep link | post/coupon/casino, missing/deleted | partial | Detail i powroty działają dla dostępnych typów; własny fallback błędu/empty istnieje. Brak bezpiecznego deleted-id dla wszystkich trzech typów. |
| 24 | Own profile | dark, light, loading, error, player card, stats, badges, histories, avatar actions | partial | Side-by-side PWA/iOS w light i dark: przywrócono strukturę karty gracza, wejścia sekcji i oszczędny shimmer. Historia pobiera początkowo 10 kuponów zamiast 60+60 wpisów, AKO jest zwinięte, Kasyno ładuje się dopiero po wyborze i używa 10-row preview z paginacją. Expand AKO i lazy Casino sprawdzone ręcznie. Avatar jest iteracyjnie kompresowany do 140000 B; upload i wymuszone error/loading pozostają bez ręcznego dowodu. |
| 25 | Public profile | data, RLS-safe history, share, missing user | partial | Profil St1Cku porównany side-by-side: statystyki i RLS-safe empty history zgodne; naprawiono pełne karty odznak, copy oraz daty odblokowania. Wymaga share i missing user. |
| 26 | Rankings | dark, light, sportsbook/casino, metrics, sorting, loading, empty, error | partial | Side-by-side dark/light: sportsbook/casino oraz profit/win rate zgodne 1:1, w tym self-row i profile links. Wymagane wymuszone empty/error. |
| 27 | Casino lobby | cards, navigation, scroll, casino dock | complete | Side-by-side PWA/iOS 402 px: karty, copy, tło, scroll i dock; dodano brakujące wejście „Kasyno” do menu i usunięto fałszywy selected tab lobby. |
| 28 | Roulette table | idle/waiting/spinning/settled, participants, wins, my bets, result | partial | Ponowny side-by-side wykazał błędne „ostatnie spiny”, status i drawer; poprawione, wymaga regresji stanów dynamicznych. |
| 29 | Roulette stake drawer | collapsed/open, all bet types, validation, queue-next-round, offline, keyboard | complete | Closed/open sprawdzone na iOS; CTA i saldo są sticky nad dockiem, wszystkie typy oraz queue-next-round są dostępne, offline blokuje zapis. Nie wysyłano stawki. |
| 30 | Blackjack betting | loading, quick stakes, validation, offline | partial | Układ stawki, presety i walidacja sprawdzone wcześniej; aktualne konto ma aktywną grę, więc końcowy screenshot regresyjny obejmuje game state, nie czysty betting state. |
| 31 | Blackjack game | playing, insurance, hit/stand/double/split, multi-hand, reveal, settled | partial | Otwarty stół, prawidłowy rewers, hierarchia i CTA poprawione side-by-side dla aktywnej gry/splitu. Foreground teraz anuluje stary staged reveal i pobiera autorytatywny stan serwera; pozostałe dynamiczne stany wymagają danych do renderu. |
| 32 | Jackpot draw | loading, unavailable, draw, suspended/resume, claim, claimed, error | partial | Rolled-over iOS naprawiony według PWA: usunięto rozciągnięty stage użyty jako tło, użyto poprawnego mobile backgroundu, dodano back/hero/meta i semantykę „Brak losowania”. Wymagane normal reveal/winner/claim/claimed fixtures. |
| 33 | Bonus campaign overlay | eligible/ineligible, claim, failure, offline | partial | Overlay i produkcyjne claim/error/offline są kompletne; backend nie wystawił aktywnej kampanii do bezpiecznego renderu user-facing. Adminowe wygasłe kampanie sprawdzone. |
| 34 | Feature poll overlay | mandatory, optional, submit failure/success, offline | partial | Mandatory/optional i submit/error/offline są kompletne; backend nie wystawił aktywnej ankiety. Adminowe formularze i wygasłe stany sprawdzone. |
| 35 | Admin shell | admin, moderator, denied, offline, tab navigation | partial | Denied sprawdzony na zwykłym użytkowniku, pełny admin na koncie użytkownika, wszystkie taby i oba motywy. Moderator i wymuszony offline nie były dostępne; gate jest jawny w kodzie. |
| 36 | Admin dashboard | loading, data, error | complete | Loading i realne statystyki/aktywność sprawdzone; naprawiono surowe `__all_lost__` na „Przegrana wszystkich”. Error ma jawny retry. |
| 37 | Admin manage bets | filters, pagination, settle/refund confirmation/errors | partial | Filtry i nowa paginacja 15/stronę sprawdzone. Edit/result/delete confirmation otwarto i anulowano bez mutacji; nie wykonywano settle/refund/delete na produkcyjnych danych. |
| 38 | Admin create bet | fields, options, validation, submit | partial | Pełny formularz i walidacja „Tytuł zakładu jest wymagany” sprawdzone. Nie utworzono testowego produkcyjnego zakładu. |
| 39 | Admin proposals | list, source badges, approve/reject flows | partial | Empty state sprawdzony; approve/reject i source badges są kompletne, lecz nie było oczekujących propozycji do bezpiecznego przejścia flow. |
| 40 | Admin categories | list, create/edit validation | partial | Lista, formularz, edit/delete controls, walidacja i nowa paginacja 10/stronę sprawdzone. Mutacji nie wykonano. |
| 41 | Admin Eniu | settings/actions/errors | complete | Formularz, tryb podglądu i logi sprawdzone. Usunięto wyciek surowych URL/workspace/JSON; błędy billing/401/unknown są teraz krótkie i przyjazne. |
| 42 | Admin bonus campaigns | list, form, state transitions | partial | Lista i walidacja formularza sprawdzone; wygasłe kampanie nie pokazują już „Wyłącz kampanię”. Nie zmieniano produkcyjnego stanu kampanii. |
| 43 | Admin feature polls | list, form, state transitions | partial | Lista, pola/options i walidacja sprawdzone; zakończone ankiety nie pokazują już „Wyłącz głosowanie”. Nie zmieniano produkcyjnego stanu ankiety. |
| 44 | Unknown/deep-link fallback | unsupported path, web fallback | complete | Zastąpiono surowy „Unmatched Route” własnym ekranem BSPLIC; iOS deep link potwierdza home CTA, production-web fallback i dock bez fałszywego selected. |

## Audyt motion parity i kosztu

| Powierzchnia | Status | Implementacja / pozostała luka |
|---|---|---|
| Główne taby i dock | complete | Natywny `react-native-pager-view` utrzymuje wybrany ekran i sąsiadów, a pozostałe strony są odmontowane. Pager używa czystego natywnego slide bez dodatkowego rotate/scale; Reanimated prowadzi tylko indikator docka i krótki press feedback. Selection zmienia się przed `router.replace`, więc routing nie blokuje feedbacku. |
| Header/dock przy scrollu | complete | Jedna współdzielona wartość UI-thread animuje header, dock i sportsbook toolbar; ukryte strony nie sterują chrome. Reduced motion ustawia stan bez przejścia. |
| Profil | complete | Sekcje wchodzą sekwencyjnie, karta gracza ma jedną rzadką warstwę shimmer, a rozwijanie AKO używa layout/fade. Brak animacji per badge, aby długa lista nie generowała pracy poza viewportem. |
| Sportsbook | complete | Wybrany kurs używa krótkiego springu zgodnego z PWA; list virtualization ograniczono do małych batchy. |
| Roulette | partial | Spin używa native driver i respektuje reduced motion; pełne przejście waiting → spinning → settled nadal wymaga realnego cyklu/fixture do oceny timingu i efektów wyniku. |
| Blackjack | partial | Staged reveal, audio i haptics istnieją, ale natywna wersja nadal nie odtwarza pełnej choreografii deal/flip/celebration PWA dla wszystkich insurance/split/result states. |
| Jackpot home | complete | Tylko dekoracja nagród wykonuje wolny ambient float, focus-gated i zatrzymywany przy reduced motion. |
| Jackpot draw | partial | Semantyka reveal/claim/resume jest natywna, lecz rozbudowany PWA ticket-flight, spotlight i winner choreography nadal nie ma pełnego odpowiednika Reanimated. To największa pozostała luka motion parity. |
| Social / engagement overlays | partial | Story timing i modal lifecycle są focus-gated; feed/reaction transitions oraz bonus/poll enter/exit nie mają jeszcze pełnego dowodu względem PWA, bo brakowało aktywnych danych. |

Wydajnościowo nie zastosowano własnego JS gesture engine ani pełnego „true cube”. Pager pozostaje przy natywnym slide, bez animowania layoutu, czytania shared values na JS thread albo utrzymywania pięciu aktywnych subskrypcji.

## Sąsiednie powierzchnie regresyjne

- Root PWA pozostaje bez zmian wizualnych i funkcjonalnych.
- Powierzchnie niewidoczne w stosie Expo nie mogą wykonywać fetchy, realtime, audio ani animacji.
- Zmiany komponentów wspólnych są sprawdzane co najmniej na jednym ekranie casino i jednym nie-casino.

## Audyt teł i artworku

| Powierzchnia | Asset / tryb | Wynik |
|---|---|---|
| Casino lobby | `hub-mobile-background.webp`, `cover` | Pionowy asset 853×1844, pełny viewport bez rozciągania; sprawdzone na iOS. |
| Roulette | `roulette-mobile-background.webp`, `cover` + koło `contain` | Pionowy asset 853×1844; artwork koła zachowuje proporcje i nie jest używany jako tło; sprawdzone ponownie po regresji docka. |
| Blackjack | `blackjack-mobile-background.webp`, `cover` + rewers karty `cover` | Pionowy asset 813×1934; aktywna gra i dolny obszar stołu sprawdzone ponownie. |
| Jackpot home card | dekoracja `daily-jackpot-prizes.png`, `contain` | Grafika jest warstwą dekoracyjną, nie rozciąga karty; status rolled-over sprawdzony. |
| Jackpot draw | pionowy `roulette-mobile-background.webp`, `cover`; `jackpot-draw-stage.png`, `contain` tylko wewnątrz stage | Naprawiono pierwotny defekt: poziomy stage nie jest już rozciągany na cały ekran. Rolled-over ma pełne, proporcjonalne tło na iPhone 17 Pro. |

Klatki z kursorem narzędzia sterującego na komponencie nie są traktowane jako samodzielny dowód pikselowy; stan i geometria były oceniane po odsunięciu wskaźnika lub na kolejnej stabilnej klatce.
