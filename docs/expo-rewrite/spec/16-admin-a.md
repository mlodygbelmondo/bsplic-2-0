# 16. Admin panel, part A: shell, dashboard, bets, create bet, AKO exclusions

Read-only spec for the native (Expo) rebuild. Snapshot: branch `expo-native-rewrite`, HEAD `fb1a971` at session start. Paths are relative to the repo root. Polish copy is quoted verbatim. Tab names are the source's own labels.

Part B (proposals, categories, Eniu bot, agent runs, bonus campaigns, feature polls) is out of scope here.

---

## Files covered

### Source (12 files, 2,441 lines total)

| Path | Lines | Role |
|---|---|---|
| `src/pages/AdminPage.tsx` | 7 | Page wrapper. Calls `usePageTitle('Admin')`, renders `<AdminLayout />` |
| `src/features/admin/components/AdminLayout.tsx` | 370 | Shell, role gating, tab router, mobile bottom nav, More sheet, desktop sidebar |
| `src/features/admin/components/DashboardTab.tsx` | 179 | Stats cards and recent-activity list |
| `src/features/admin/dashboardApi.ts` | 80 | `admin_get_dashboard_summary` RPC wrapper and camelCase mapping |
| `src/features/admin/components/ManageBetsTab.tsx` | 906 | Bet list (search, filters, pagination), edit dialog, settle/correct dialog, delete |
| `src/features/admin/components/manageBetsFilters.ts` | 38 | `filterBets` pure function (status and type filters, title search) |
| `src/features/admin/settlementApi.ts` | 29 | `admin_settle_bet` RPC wrapper |
| `src/features/admin/helpers.ts` | 123 | Type and option normalisers, winner encoding, option locking |
| `src/features/admin/constants.ts` | 18 | `AdminTab` union, sentinel winner values, `NO_CATEGORY_VALUE`, `EditableBetType` |
| `src/features/admin/components/CreateBetTab.tsx` | 368 | Create-bet form |
| `src/features/admin/components/AkoExclusionsEditor.tsx` | 161 | Shared AKO exclusions picker (used by edit dialog and create tab) |
| `src/features/admin/api/akoExclusions.ts` | 162 | AKO exclusion and bet create/update RPC wrappers |

### Tests read (8 files, 1,008 lines total)

| Path | Lines | What it pins |
|---|---|---|
| `src/features/admin/components/AdminLayout.test.tsx` | 198 | Moderator vs admin visibility, default tab, five-slot mobile bar, nav hide on scroll, More sheet |
| `src/features/admin/components/ManageBetsTab.test.tsx` | 264 | Save blocked while AKO loads or fails; `filterBets` combined and active-only |
| `src/features/admin/components/AkoExclusionsEditor.test.tsx` | 83 | Search adds matching bets, excludes current bet; reason edit and remove |
| `src/features/admin/api/akoExclusions.test.ts` | 149 | RPC names and payload shapes for fetch, replace, create, update; errors thrown |
| `src/features/admin/api/akoExclusionsMigration.test.ts` | 50 | Source-text checks on a migration and RLS SQL (see gotcha G1) |
| `src/features/admin/helpers.test.ts` | 142 | `parseWinningOptions`, `encodeWinningOptions`, `normalizeType`, `normalizeOptions`, editable options, `normalizeCouponStatus`, `getErrorMessage` |
| `src/features/admin/dashboardApi.test.ts` | 63 | Aggregate RPC call and mapping |
| `src/features/admin/settlementApi.test.ts` | 59 | Canonical settle RPC call; RPC error rethrown for toast |

### Migrations

| Path | Lines | Relevance |
|---|---|---|
| `supabase/migrations/20260622010000_admin_bet_ako_rpc_contract.sql` | 219 | Defines `admin_replace_bet_ako_exclusions` (line 4, superseded body), `admin_create_bet_with_ako_exclusions` (line 95, `RETURNS UUID`), `admin_update_bet_with_ako_exclusions` (line 154, `RETURNS UUID`); REVOKE/GRANT at 212-219 |
| `supabase/migrations/20260726102000_agent_ako_exclusions.sql` | 251 | Effective definitions: `public.admin_replace_bet_ako_exclusions` wrapper (line 193) calls `private.replace_bet_ako_exclusions` (line 94; `FOR UPDATE` at 129, `DELETE` at 136); `admin_get_bet_ako_exclusions` (177) |

Consulted for the contract (not re-read in full):
- `supabase/migrations/20260618043000_optimize_jackpot_ako_rls_policies.sql` (AKO RLS: admin manage policy dropped, separate INSERT/UPDATE/DELETE policies using `(SELECT auth.uid())`)
- `supabase/migrations/20260524172000_canonical_sportsbook_settlement_rpc.sql:383` (`admin_settle_bet`)
- `supabase/migrations/20260610231207_supabase_disk_io_optimization.sql:475` (`admin_get_dashboard_summary()`)

Route shell: `src/lib/boot/route-modules.ts:12` (`loadAdminPage`). No admin query factories or React Query keys exist in `src/lib/boot` or `src/lib/query-client.ts`.

---

## Surfaces

Each surface lists entry point, layout, copy, icons, states, interactions and motion. Layout is one line for 390px mobile and one line for desktop at lg and up. The desktop sidebar starts at `md` (768px), so the 768-1023px range already uses the desktop shell.

### S1. Admin shell and tab router (`AdminLayout.tsx`, `AdminPage.tsx`)

**Entry point.** Route `/admin` renders `AdminPage` (sets title `Admin`) and `AdminLayout`. The route chunk is loaded by `loadAdminPage` (`src/lib/boot/route-modules.ts:12`).

**Gating and states** (`AdminLayout.tsx:129-177`):
- `loading` from `useAuth()`: render nothing (`return null`). No spinner.
- Neither admin nor moderator: `<Navigate to="/" />`.
- Moderator: `availableTabs` = proposals only. Default and only tab: `proposals`. Heading `Panel Moderatora`. Mobile bar is one slot (`availableTabs`, line 190-196).
- Admin: all nine tabs. Default tab `manage`. Heading `Panel Admina`.
- The active tab is `useState<AdminTab>('manage')`. If the active key is not in `availableTabs`, it falls back to `defaultTab` (derivation at `AdminLayout.tsx:179-185`). One exception: for admins, the `more` key is kept even if it is not in `availableTabs`.
- Tabs are state, not URLs. There are no deep links to a tab, and a reload resets to `manage` (admin) or `proposals` (moderator).

**Tab table** (`TABS`, `AdminLayout.tsx:57`). Columns: key, sidebar/sheet label, mobile visible short label, icon.

| Key | Label | Short label | Icon | Mobile slot |
|---|---|---|---|---|
| dashboard | Dashboard | Panel | LayoutDashboard | More |
| manage | Zarządzaj | Bety | ListChecks | Primary 1 |
| create | Utwórz zakład | Dodaj | PlusCircle | Primary 3 |
| proposals | Propozycje | Propozycje | Lightbulb | Primary 2 |
| categories | Kategorie | Kat. | Tag | More |
| eniu | Eniu | Eniu | Bot | More |
| agent | Agent betów | Agent | Bot | More |
| bonuses | Bonusy | Bonus | BadgePlus | Primary 4 |
| feature-polls | Głosowania | Głosy | Vote | More |
| more | Więcej | Więcej | MoreHorizontal | Primary 5 (admin only) |

- `MOBILE_PRIMARY_TAB_KEYS` (line 94): `manage, proposals, create, bonuses, more`.
- `MOBILE_MORE_TAB_KEYS` (line 102): `dashboard, categories, eniu, agent, feature-polls`.
- All tab bodies are `React.lazy` with `AdminTabFallback` as the Suspense fallback (`AdminLayout.tsx:40-48`, `260-292`). Part A covers DashboardTab, CreateBetTab and ManageBetsTab.

**Layout.**
- **390px:** full-width scroll container (`data-testid="admin-scroll-container"`, `AdminLayout.tsx:241-243`, bottom padding `calc(5rem + env(safe-area-inset-bottom))`). Inner content wrapper `mx-auto w-full max-w-none p-4 sm:p-6 md:p-8` (`AdminLayout.tsx:245`). Fixed bottom nav `aria-label="Nawigacja admina"` (line 300), `h-[72px] w-[calc(100vw-1rem)] max-w-[430px]` (line 324), five slots (the test asserts five). Icons `h-5 w-5`. The page's own `body` and `html` have `overflow: hidden` while mounted (restored on unmount, lines 164-172).
- **lg+:** `w-56` left sidebar (`hidden md:flex`, line 208) listing the available tabs by label and icon, heading `Panel Admina` / `Panel Moderatora` (line 211). Mobile bar hidden. Content wrapper is the same `p-4 sm:p-6 md:p-8` with `max-w-none` (`AdminLayout.tsx:245`).

**Mobile More sheet.** Opened by the `Więcej` slot. Heading `Pozostałe sekcje` (line 273), `grid gap-3 sm:grid-cols-2`. Each card: `min-h-[56px] rounded-xl bg-card p-4 card-shadow`, icon box `h-10 w-10 rounded-lg bg-primary/10 text-primary` with icon `h-5 w-5` (line 284), label `font-semibold`. Admin only shows More cards that are in `availableTabs`.

**Copy.**
- Nav `aria-label`: `Nawigacja admina`.
- Slot `aria-label` = full label (e.g. `Zarządzaj`), visible text = short label (e.g. `Bety`). The test asserts the aria labels in order: `Zarządzaj`, `Propozycje`, `Utwórz zakład`, `Bonusy`, `Więcej`.

**States.** Loading (returns null). Redirect for non-staff. Active slot: `font-bold` and `mobileActiveClassName`; inactive: `mobileInactiveClassName`. More slot is active when `activeTab` is `more` or any More key.

**Interactions.**
- Tap a slot: `setTab(key)`. Tap `Więcej`: opens the sheet with `activeTab === 'more'`. Tap a card: `setTab(key)` and the sheet closes.
- Deliberate downward scroll on the scroll container hides the nav (`translate-y-full opacity-0`) via `getNextScrollChromeState` (`@/lib/scroll-chrome`, call at line 148). The nav returns on upward scroll.
- Each tab switch is a `setTab`. The scroll container is not reset in the covered code (see G9).

**Icons (lucide-react).** `LayoutDashboard, ListChecks, PlusCircle, Lightbulb, Tag, Bot, BadgePlus, Vote, MoreHorizontal`. Nav icon `strokeWidth` 2.4 when active, 2 when inactive (line 351).

**Motion.**
- Nav: `transition-[transform,opacity] duration-200 ease-out` with a hide/reveal (line 302).
- `liquid-glass-react` wraps the nav (lines 308-310): `displacementScale 46, blurAmount 0.035, saturation 152, aberrationIntensity 1.35, elasticity 0.04, cornerRadius 28`, `overLight={false}` (line 317). No `usePerfLite` or `html.perf-lite` fallback exists in the covered files (grep verified). See G6.
- Theme: `useTheme()` (`theme` used for `getLiquidGlassMobileNavBorderClassName`, line 128).

### S2. Dashboard tab (`DashboardTab.tsx`, `dashboardApi.ts`)

**Entry point.** Tab `dashboard`. Admin only, in the sidebar and in the More sheet. Not visible to moderators.

**Load.** `useEffect` on mount calls `fetchAdminDashboardSummary()` (`DashboardTab.tsx:33`). No refresh control and no re-fetch action.

**Layout.**
- **390px:** six stat cards in two columns (`grid-cols-2 gap-3`), then the activity card full width below.
- **lg+:** six stat cards in three columns (`sm:grid-cols-3`, line 106), then the activity card below.

**Copy.**
- Loader label: `Wczytywanie statystyk...` (`<SectionLoader>`, line 51).
- Error toast: `Nie udało się załadować statystyk: ${msg}`; `msg` falls back to `Nieznany błąd` (line 42).
- Inline error: `Nie udało się załadować danych. Odśwież stronę, aby spróbować ponownie.` (line 58). This copy tells the user to refresh the page, and there is no control to retry.
- Stat cards (lines 66-96), each `bg-card rounded-xl p-4 card-shadow`:

| Label | Icon | Value |
|---|---|---|
| Łączna liczba zakładów | BarChart3 | `totalBets` |
| Łączna pula | Wallet | `${totalPool.toFixed(0)} zł` |
| Propozycje oczekujące | Lightbulb | `pendingProposals`; `text-primary` when > 0 |
| Aktywne zakłady | Activity | `activeBets` |
| Rozstrzygnięte dziś | CheckCircle2 | `resolvedToday` |
| Top kategoria | Tag | `topCategory` or `—` |

- Activity card title `Ostatnia aktywność` (Clock icon, line 129).
- Empty: `Brak rozstrzygniętych zakładów.` (line 134).
- Rows (list at line 137): circle `bg-emerald-100` with Trophy icon, bet title, `Wynik: {winningOption}` (line 148), relative time.
- Relative time (`getRelativeTime`): under 1 min `teraz`; under 60 min `{m} min temu`; under 24 h `{h} h temu`; one day `wczoraj`; otherwise `{d} dni temu`.

**States.** Loading (SectionLoader holds the boot splash per AGENTS.md when mounted), error (toast plus inline error), empty activity, zero values (`—` for top category).

**Interactions.** None. Stat cards and activity rows are not tappable. No charts.

**Motion.** None in the covered code. No chart library is used.

### S3. Manage bets tab, list (`ManageBetsTab.tsx`, `manageBetsFilters.ts`)

**Entry point.** Tab `manage`. Default tab for admins. Mobile slot `Bety` (aria `Zarządzaj`).

**Load.** `useEffect(() => { fetchBets(); }, [])` (`ManageBetsTab.tsx:123`). Two requests in `Promise.all`: all bets (`.select('*').order('created_at', ascending false)`) and categories (`.select('*').order('sort_order')`). No server pagination. The full table is kept in state and filtered client-side with `filterBets`, then sliced to 15 per page.

**Layout.**
- **390px:** heading row, search input, two filter selects stacked (`grid-cols-1 gap-3`), then the pagination bar (only when `!loading && filtered.length > 15`) and the bet cards (`md:hidden`).
- **lg+:** same heading, search and filters inline (`md:w-auto md:min-w-[360px]`, two columns from `sm`), then a table (`hidden md:block`, `min-w-[1060px] table-fixed`) with a pagination bar above and below.

**Filters.**
- Search `Input`: placeholder `Szukaj zakładów...`, aria-label `Szukaj zakładów`.
- Status `Select`: placeholder `Status`. Items: `Wszystkie statusy` (all), `Aktywne` (active), `Rozstrzygnięte` (resolved), `Zamknięte` (closed).
- Type `Select`: placeholder `Typ zakładu`. Items: `Wszystkie typy` (all), `Single`, `1/2` (value `12`), `1X2`, `Multi`.
- Page resets to 0 on any search or filter change (line 158).

**Pagination.**
- `PAGE_SIZE = 15` (line 70). Bar at top (line ~410) and bottom (line ~569).
- Buttons: `Wstecz` and `Dalej` (text is `hidden sm:inline`, lines 849 and 881), aria `Poprzednia strona` (845) and `Następna strona` (878), page buttons aria `Strona N` (864).
- Range: seven or fewer pages show all. More pages show first, ellipsis, current ±1, ellipsis, last.

**Copy.**
- Loading: `Wczytywanie zakładów...` (line 417). Empty: `Brak zakładów` (line 419 mobile, line 489 desktop). This is the only empty copy. No separate filtered-empty copy was found.
- Error toast: `getErrorMessage(err, 'Nie udało się pobrać zakładów')`.

**Mobile cards** (`md:hidden`, key `bet.id`, line 415):
- Title (`line-clamp-2`), type uppercase, `BOOST` badge with Sparkles when `is_bsplicboost` (line 431), `{bet_count} zakł.`, status badge (line 437).
- Action row (each `min-h-11`):
  - `Edytuj` (aria `Edytuj {title}`, lines 441-442): opens the edit dialog.
  - `Korekta` or `Wynik` with Trophy (lines 452-453): opens the resolve dialog. Shows Loader2 while `resolvingBetId` matches.
  - `1.00` with RotateCcw (lines 457-458): calls `resolveBet(bet, [], 'refund')` directly, no confirmation (G2).
  - Trash2 icon-only (line 462, aria `Usuń {title}`): delete with `window.confirm`.

**Desktop table** (`hidden md:block`, line 472):
- Columns: `Tytuł`, `Typ`, `Zakłady`, `Status`, `Akcje`. Empty row at line 489.
- Actions column:
  - `Edytuj` with Pencil (aria at line 512, label line 515).
  - Trophy button, aria `${winning_option ? 'Korekta wyniku dla' : 'Ogłoś wynik dla'} ${title}` (line 524), label `Korekta wyniku` or `Ogłoś wynik` (line 529).
  - Overflow `DropdownMenu` trigger, aria `Więcej opcji` (line 534, MoreHorizontal). Items: `Rozlicz 1.00` (line 541-543, calls `resolveBet(bet, [], 'refund')`, no confirmation) and `Usuń zakład` (line 554, `text-destructive`, label `Usuwanie…` while deleting).

**Status badges** (`statusBadge`, line 334). Checked in this order:
1. `ZWROT` (muted): winners include `__refund__`.
2. `PRZEGRANA` (destructive): winners include `__all_lost__`.
3. `ROZSTRZYGNIĘTY` (success): `winning_option` set.
4. `AKTYWNY` (primary): `is_active`.
5. `ZAMKNIĘTY` (muted): otherwise.

**States.** Loading, empty (`Brak zakładów`, the only empty copy, see Copy), error toast, per-row `resolvingBetId` spinner, per-row delete `Usuwanie…`.

**Interactions.** Search (instant, client-side), status and type selects, pagination, row or card actions, edit, resolve, refund, delete.

**Motion.** Loader2 spin on the resolving button. Dropdown and dialog transitions are the shadcn defaults (not re-read).

### S4. Edit bet dialog (`ManageBetsTab.tsx`, `helpers.ts`, `api/akoExclusions.ts`)

**Entry point.** `Edytuj` on a card or table row. `openEditor(bet)` (line 161).

**Load on open.**
- Options: `lockEditableOptionsByType(betType, toEditableOptions(normalizeOptions(bet.options)))`.
- AKO: `fetchBetAkoExclusions(bet.id)`. A ref (`activeEditorExclusionsRequest`, line 89) guards `then`, `catch` and `finally` so a stale response for another bet is ignored.
- Save stays blocked until the AKO request finishes (see the update rules below).
- AKO load error toast: `getErrorMessage(err, 'Nie udało się pobrać wykluczeń AKO')`.

**Layout.**
- **390px:** dialog class `w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[calc(var(--app-viewport-height,100svh)-2rem)] overflow-y-auto p-4 sm:p-6` (`ManageBetsTab.tsx:575`). Field stacking and Save position are unverified (not read in full).
- **lg+:** `sm:max-w-2xl` from the same class at `ManageBetsTab.tsx:575`. Centring is the shadcn default (unverified).

**Copy.**
- Title `Edytuj zakład`. Description `Zmień dane zakładu, opcje i wykluczenia AKO.`
- Fields:
  - `Tytuł` (Input).
  - `Kategoria` (Select). Placeholder `Wybierz`. First item `Brak kategorii` (value `__none__`, line 598). Items `{emoji} {name}`.
  - `Typ` (Select): `Single`, `1/2`, `1X2`, `Multi`. Changing type calls `lockEditableOptionsByType` again.
  - `Data zakończenia` (datetime-local).
- Switches with labels: `Na żywo` (line 627), `BSPLICBOOST` (line 631), `Aktywny` (line 635).
- Option rows: name Input, odds Input (`step 0.01`, `min 1`, `w-20`).
  - Remove button, aria `Usuń opcję N` (line 647). Shown only for non-fixed types with more than two options.
  - `Dodaj opcję` (line 655). Non-fixed types only. Appends `{ name: '', odds: '2' }`.
- `AkoExclusionsEditor` with `availableBets={bets}` (~line 661, see S8).
- AKO load-failed copy: `Wykluczenia AKO nie wczytały się poprawnie. Zamknij edycję i spróbuj ponownie.` (line 675).
- Save button: `Zapisz zmiany` or `Zapisywanie...` (line 680).

**Validation and save** (`updateBet`, line 199), in this order and with these toasts:
1. AKO still loading: `Poczekaj, aż wykluczenia AKO się wczytają` (line 201).
2. AKO failed to load: `Wykluczenia AKO nie wczytały się poprawnie` (line 202).
3. Empty title: `Tytuł jest wymagany` (line 203).
4. Empty option label: `Uzupełnij etykiety wszystkich opcji` (line 209).
5. Odds not finite or not > 0: `Podaj poprawny kurs dla opcji ${n}` (line 215).
6. Too few options: `Zakład musi mieć minimum 1 opcję` (single) or `Zakład musi mieć minimum 2 opcje` (line 218).
7. Invalid date: `Wybierz poprawną datę zakończenia` (line 221).

On success: toast `Zakład zaktualizowany` (line 240), `closeEditor`, `fetchBets()`. On failure: `getErrorMessage(err, 'Nie udało się zaktualizować zakładu')` (line 244). Payload is `updateBetWithAkoExclusions` (see the data contract).

**States.** AKO loading (save blocked), AKO failed (save blocked and inline copy), saving (`Zapisywanie...`), validation errors (toast).

**Interactions.** Edit fields, add or remove options, toggle switches, pick category and type, edit AKO exclusions, save, close.

**Motion.** Dialog enter and exit (shadcn defaults, not re-read).

### S5. Settle and correct dialog (`ManageBetsTab.tsx`, `settlementApi.ts`)

**Entry point.** Mobile `Korekta` or `Wynik` (card). Desktop `Korekta wyniku` or `Ogłoś wynik` (table icon). Also the special actions in the dialog. The `1.00` actions skip this dialog (G2).

**Mode.** `isCorrection = Boolean(bet.winning_option)`. A bet with a winner is in correction mode.

**Layout.**
- **390px:** full-width dialog. Option buttons stacked, `min-h-11`. Scope radios stacked. Submit at the bottom.
- **lg+:** centred dialog. Same content.

**Dismiss lock.** While `isResolveInProgress`, `onEscapeKeyDown` and `onPointerDownOutside` are prevented (lines 692-696). The close X is hidden with `[&>button]:hidden` (line 691).

**Copy.**
- Title: `${winning_option ? 'Korekta wyniku' : 'Ogłoś wynik'}: {title}` (lines 700-701).
- Description: correction `Wybierz nowe rozstrzygnięcie i zakres korekty.`; new `Wybierz opcje, które wygrały.`
- Scope block (correction only): label `Zakres korekty`. `RadioGroup` aria `Zakres korekty wyniku` (line 717):
  - `Tylko zakłady nadal pending` (`pending_only`, line 722).
  - `Wszystkie zakłady (także już rozliczone, z korektą salda)` (`all`, line 728).
- Hint (lines 739-740):
  - multi: `Kliknij opcje które wygrały (możesz wybrać wiele):`
  - other types: `Wybierz wygraną opcję (dla tego typu zwykle 1):`
- Option buttons (lines 750-758): `aria-pressed` toggle, aria `Opcja {name}`, odds with `toFixed(2)`.
- Submit (lines 776-782): `Zapisz korektę` or `Ogłoś wynik`, plus ` ({N} wybranych)`. Disabled when nothing is selected.
- Non-multi warning step (lines 790-800):
  - `Wybrano więcej niż 1 opcję dla typu {TYPE}`
  - `To niestandardowe rozliczenie. Potwierdź, że chcesz kontynuować.`
  - Buttons `Wróć` (line 796) and `Potwierdź` (line 800).
- Special actions (footer):
  - `Ogłoś przegraną (wszyscy)` with CircleOff (line 808). Shown only when `is_bsplicboost`. Calls `submitSpecialSettlement('force_lost')`.
  - `Rozlicz 1.00 (zwrot)` with RotateCcw (line 812). Calls `submitSpecialSettlement('refund')`.

**Submit logic.**
- `submitNormalSettlement` (line 347): if the bet is not `multi` and more than one option is selected, the first submit moves to `non_multi_warning` (line 352). `Potwierdź` submits.
- `resolveBet` (line 269) calls `settleBetWithBackend({ betId, winningOptionNames, mode, scope })`.
- `submitSpecialSettlement` (line 359) guards on `isResolveInProgress` and calls `resolveBet(resolveModal, [], mode, correctionScope)`. The scope comes from the dialog, not forced to `pending_only`.
- Card and menu `1.00` call `resolveBet(bet, [], 'refund')` with the default scope `pending_only`.

**Success.** Toasts:
- Refund: `Korekta zapisana jako zwrot` (correction) or `Zakład rozliczony jako zwrot` (new).
- Force lost: `Korekta zapisana jako przegrana dla wszystkich` (correction) or `Zakład rozliczony jako przegrany dla wszystkich` (new).
- Normal: `Korekta wyniku zapisana` (correction) or `Wynik ogłoszony!` (new). Confetti `{ particleCount: 100, spread: 70, origin: { y: 0.6 } }` only for a new normal settlement.

After success: reset modal, selected winners, step and scope, then `fetchBets()`.

**Failure.** Toast `Nie udało się ogłosić wyniku`. The RPC error is rethrown by `settleBetWithBackend` (G7).

**States.** Idle, in progress (Loader2, dismiss locked), warning step, no selection (submit disabled), correction (scope radios shown).

**Interactions.** Pick options (toggle), pick scope (correction only), submit, confirm non-multi, special actions, back.

**Motion.** Confetti once on a new normal settlement. Loader2 spin during the request. Dialog transitions (shadcn default).

### S6. Delete bet (`ManageBetsTab.tsx`)

**Entry point.** Mobile icon button (aria `Usuń {title}`, line 462). Desktop menu item `Usuń zakład` (line 554).

**Flow.** `window.confirm(\`Czy na pewno chcesz usunąć zakład "${bet.title}"?\`)` (line 309). On confirm: `supabase.from('bets').delete().eq('id', bet.id)`. If the editor or resolve dialog is open for this bet, it is closed.

**Copy.** Confirm text above. Success `Zakład usunięty` (line 323). Failure `Nie udało się usunąć zakładu`. Pending label `Usuwanie…` (desktop).

**Layout.** 390px: icon button in the card. lg+: menu item in the overflow dropdown.

**States.** Confirm open, deleting (`Usuwanie…`), done.

**Motion.** None.

### S7. Create bet tab (`CreateBetTab.tsx`)

**Entry point.** Tab `create`. Admin only. Mobile slot `Dodaj` (aria `Utwórz zakład`). Sidebar `Utwórz zakład`.

**Load.** Two queries in `Promise.all` (lines 40-46): categories (`.select('*').order('sort_order')`) and active bets (`.select('*').eq('is_active', true).order('created_at', ascending false)`). No error toast. Active bets feed `availableAkoBets` for the AKO picker.

**Layout.**
- **390px:** single column. Fields stacked. A sticky submit bar at the bottom (`fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 p-4 bg-background/80 backdrop-blur-md border-t border-border lg:hidden`, lines 355-363), above the bottom nav.
- **lg+:** two columns (`lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]`, line 174). Left: basic info. Right: options and AKO. The right column's height is synced to the left column with a ResizeObserver (lines 84-85) when `innerWidth >= 1024`. Desktop submit button in a `hidden lg:block` block (lines 340-348).

**Copy.**
- Section `Podstawowe informacje` (line 178).
- `Tytuł zakładu` (line 181), placeholder `np. Kto wygra mecz Polska - Niemcy?`.
- `Kategoria` (line 195), placeholder `Wybierz kategorię`.
- `Typ zakładu` (line 208). Items `Single (1 opcja)`, `1/2 (Dwie opcje)`, `1X2 (Trzy opcje)`, `Multi (Wiele opcji)`.
- `Data zakończenia` (line 224).
- Section `Opcje dodatkowe` (line 239):
  - `Na żywo` / `Oznacz jako wydarzenie live` (line 244, switch line 247).
  - `BSPLICBOOST` / `Wyróżnij wyższym kursem` (line 252, switch line 255).
- Heading `Możliwe typy` (line 275).
- `Dodaj opcję` (lines 282-284). Non-fixed types only.
- Option name placeholder `Nazwa opcji (np. Polska)` (line 302). Odds placeholder `Kurs` (line 320).
- Remove button aria `Usuń opcję N` (line 329). Non-fixed types with more than two options only.
- Submit label `Utwórz zakład` or `Tworzenie...`. Aria while submitting: `Tworzenie zakładu w toku`.

**Defaults** (lines 26-31):
- `categoryId` `''`, `betType` `'12'`, `isLive` `false`, `isBsplicboost` `false`.
- `endsAt` = `toInputDateTime(getTomorrowAt2359())`.
- `options` = `[{ name: '1', odds: '2' }, { name: '2', odds: '2' }]`.
- `akoExclusions` = `[]` (`CreateBetTab.tsx:34`).

**Type effect** (lines 55-61): `single` gives `[1:2]`; `12` gives `[1:2, 2:2]`; `1x2` gives `[1:2, X:3, 2:2]`; `multi` keeps the previous list when it has two or more options, else two blank options.

**Validation** (before submit, in this order):
1. Empty label: `Uzupełnij etykiety wszystkich opcji` (line 108).
2. Too few options: `Dodaj co najmniej 1 opcję` (single) or `Dodaj co najmniej 2 opcje` (line 114).
3. Bad odds: `Podaj poprawny kurs dla opcji N` (line 125).
4. Empty title: `Tytuł jest wymagany` (line ~136).

No `endsAt` validation message was recorded for this tab (see G4).

**Submit.** `createBetWithAkoExclusions` with `categoryId || null` (line 144) and `new Date(endsAt).toISOString()` (line 147).

**Success.** Toast `Zakład utworzony!` (line 153). Reset (lines 154-161): title, exclusions, boost, `endsAt`, options. Not reset: `categoryId`, `betType`, `isLive` (G3).

**Failure.** `getErrorMessage(err, 'Nie udało się utworzyć zakładu')` (line 163).

**States.** Loading (categories and active bets fetched silently), submitting (`Tworzenie...`, aria), validation toasts, success reset.

**Motion.** None in the covered code. The sticky bar uses `backdrop-blur-md` (a filter effect, see G6).

### S8. AKO exclusions editor (`AkoExclusionsEditor.tsx`, `api/akoExclusions.ts`)

**Entry point.** Embedded in the edit dialog (S4, with `currentBetId`) and in the create tab (S7).

**Props.** `availableBets`, `value` (drafts), `onChange`, `currentBetId?`, `disabled = false`, `loading = false`.

**Layout.**
- **390px:** stacked. Search input, result list (max 5), then the selected exclusion list. Each selected item has a title line, a reason Input and a remove button.
- **lg+:** same content in the dialog or right column.

**Copy.**
- Heading `Wykluczenia AKO` (line 74). Description `Nie pozwalaj łączyć tego zakładu z wybranymi zdarzeniami na kuponie AKO.` (line 76).
- Label `Szukaj wykluczenia AKO` (line 86, id `ako-exclusion-search`). Placeholder `Wpisz tytuł zakładu` (line 92).
- Loading `Wczytywanie wykluczeń…` (line 99). Empty selection `Brak wykluczeń dla tego zakładu.` (line 156).
- Reason placeholder `Powód (opcjonalnie)` (line 148).
- Result buttons (key `bet.id`, line 106): aria `Dodaj {title}` (line 110), with Plus icon.
- Selected rows (key `exclusion.betId`, line 124): title, remove X with aria `Usuń {title}` (line 135), reason Input aria `Powód dla {title}` (line 147, `h-8 text-xs`).

**Search rules.** Needs at least 2 characters (line 36). Candidates are active bets, excluding `currentBetId` and already-selected bets, case-insensitive substring on title, `.slice(0, 5)` (line 44). Adding an item clears the search.

**States.** Loading (`Wczytywanie wykluczeń…`), empty selection, disabled (`disabled` prop). No-results state is untested: no test covers it, and no dedicated no-results copy was found.

**Interactions.** Type to search, add a result, edit a reason (updates on each change via `onChange`), remove an item.

**Motion.** None.

---

## Data contract

### Supabase direct table access

| Call | Where | Shape | Consumer | On error |
|---|---|---|---|---|
| `from('bets').select('*').order('created_at', { ascending: false })` | `ManageBetsTab.tsx:123` `fetchBets` | Returns `Bet[]` | Bet list, editor state | Toast `Nie udało się pobrać zakładów` (via `getErrorMessage`) |
| `from('categories').select('*').order('sort_order')` | `ManageBetsTab.tsx` (`fetchBets`); `CreateBetTab.tsx:40-46` | Returns categories (`id`, `name`, `emoji`, `sort_order`, ...) | Category selects, `Brak kategorii` | ManageBetsTab: toast; CreateBetTab: silent |
| `from('bets').select('*').eq('is_active', true).order('created_at', { ascending: false })` | `CreateBetTab.tsx:40-46` | Returns `Bet[]` | `availableAkoBets` in AKO picker | Silent |
| `from('bets').delete().eq('id', bet.id)` | `ManageBetsTab.tsx:309` | Delete by id, RLS enforced | Delete action | Toast `Nie udało się usunąć zakładu` |

### RPC calls

| RPC | Args (exact names) | Returns | Used by | Notes |
|---|---|---|---|---|
| `admin_get_dashboard_summary` | none | `{ stats: { total_bets, total_pool, pending_proposals, active_bets, resolved_today, top_category }, recent_activity: [{ id, title, winning_option, resolved_at }] }` | `dashboardApi.ts:42` | Maps to camelCase (lines 56-61); `toNumber` makes non-finite values 0 (line 77); `top_category` nullable |
| `admin_settle_bet` | `p_bet_id` (uuid), `p_winning_options` (string[]), `p_mode` (`normal` / `refund` / `force_lost`), `p_scope` (`pending_only` / `all`) | Json | `settlementApi.ts`; `ManageBetsTab.tsx:269` | Throws the raw PostgrestError (G7) |
| `admin_get_bet_ako_exclusions` | `p_bet_id` | Rows `{ id, betId, title, reason }` | `api/akoExclusions.ts` `fetchBetAkoExclusions` | `normalizeRows` keeps rows with `betId` and `title`; `reason ?? null` |
| `admin_replace_bet_ako_exclusions` | `p_bet_id`, `p_exclusions` (`[{ betId, reason }]`) | Rows | `replaceBetAkoExclusions` | No production callers (open question Q2) |
| `admin_create_bet_with_ako_exclusions` | `p_title`, `p_category_id`, `p_bet_type`, `p_options` (`[{ name, odds: number }]`), `p_ends_at`, `p_is_live`, `p_is_bsplicboost`, `p_exclusions` | UUID string | `createBetWithAkoExclusions` | Throws `Zakład utworzony bez identyfikatora` when id missing |
| `admin_update_bet_with_ako_exclusions` | `p_bet_id`, `p_title`, `p_category_id`, `p_bet_type`, `p_options`, `p_ends_at`, `p_is_live`, `p_is_bsplicboost`, `p_is_active`, `p_exclusions` | UUID string | `updateBetWithAkoExclusions` | Throws `Zakład zaktualizowany bez identyfikatora` when id missing |

Error wrapping: all `akoExclusions.ts` RPCs throw `new Error(error.message)`. `settlementApi.ts` throws the raw PostgrestError object (not an `Error` instance).

### Wire formats

- `p_exclusions` item: `{ betId: string, reason: string | null }`. Reason is trimmed; empty becomes `null`.
- `p_options` item: `{ name: string, odds: number }`.
- Dates: edit and create send `new Date(endsAt).toISOString()` for `datetime-local` input values. Input has no timezone, so it is read as device-local time.
- `bets.winning_option` (text): one winner is a plain string; several winners are a JSON array string (`encodeWinningOptions`). Sentinels `__refund__` and `__all_lost__`. `parseWinningOptions`: null or empty gives `[]`; JSON array gives its string entries; anything else gives `[value]`.

### React Query, storage, realtime

- React Query: none in the covered files. No query keys. No preload entries (`src/lib/boot/preload.ts` has no admin factories).
- localStorage and sessionStorage: none (grep verified).
- Realtime channels: none.
- Contexts used: `useAuth()` (`isAdmin`, `isModerator`, `loading`), `useTheme()` (`theme`).
- Native-relevant libraries used in the covered code: `liquid-glass-react`, `canvas-confetti`, `sonner` (`toast`), `lucide-react`, Radix primitives (Dialog, Select, Switch, RadioGroup, DropdownMenu, Label), shadcn `Button`, `Input`, `Pagination`.

---

## Business rules

1. **Access.** Admin sees all nine tabs (default `manage`). Moderator sees only `proposals`, which is outside part A. Anyone else is redirected to `/`. Null is rendered while auth is loading.
2. **Status filter.** `active` = `is_active && !winning_option`. `resolved` = `winning_option` set. `closed` = `!is_active && !winning_option` (`manageBetsFilters.ts`).
3. **Type filter.** `all`, or exact match on `bet_type`. Values are `single`, `12`, `1x2`, `multi`.
4. **Search.** Trimmed, lowercased, substring match on title. Combined with status and type (AND).
5. **Page size.** 15. Page resets to 0 on any filter or search change.
6. **Type normalisation.** `single`, `1x2`, `multi` are kept. Anything else becomes `12` (`normalizeType`).
7. **Option names and odds.** Name falls back to `Opcja N`. Odds fall back to 1 when not > 0 (`normalizeOptions`).
8. **Locked option sets** (`lockOptionsByType`, `||` fallbacks 2 and 3):
   - `single`: one option at odds 2.
   - `12`: `1` and `2` at odds 2.
   - `1x2`: `1` and `X` at odds 3, `2` at odds 2.
   - `multi`: keeps the current list when it has 2 or more options, else two blank options at odds 2.
9. **Editable options** (`lockEditableOptionsByType`, `??` fallbacks 2 and 3): odds become strings. An empty string is preserved.
10. **Fixed-count types** (`single`, `12`, `1x2`): no add or remove. `multi` allows add and remove (remove only when more than two). Option set is re-locked on type change in both the edit and create forms.
11. **Edit save gating.** Save is blocked while AKO exclusions are loading, and also when they failed to load.
12. **Edit validation order** and copy are listed in S4. Minimum options message differs from create (G5).
13. **Create validation order** and copy are listed in S7. Title is checked last (G5).
14. **Create defaults:** end date tomorrow at 23:59 local (`getTomorrowAt2359`). Type `12`, two options at odds 2.
15. **Normal settlement, single winner:** one selected option, `normal` mode, scope not used.
16. **Non-multi with more than one winner:** the first submit shows the warning step. Confirm to submit.
17. **Multi:** any number of winners.
18. **Correction:** when the bet already has a winner, the title says `Korekta wyniku`, the scope radio is shown, and the submit label is `Zapisz korektę`. Scope `pending_only` changes only unsettled bets. Scope `all` also re-settles settled bets and adjusts balances (copy: `z korektą salda`).
19. **Refund** (`mode refund`, winners `[]`): the bet is settled as a refund. Shown as `ZWROT` badge. Available from the card, the menu (`Rozlicz 1.00`, scope `pending_only`), and the dialog (`Rozlicz 1.00 (zwrot)`, scope from the dialog).
20. **Force lost** (`mode force_lost`, winners `[]`): shown only when `is_bsplicboost`. Shown as `PRZEGRANA`. Scope from the dialog.
21. **Confetti** only on a new normal settlement (not corrections, refunds or force lost).
22. **Delete** is a hard delete of the bet row, guarded by a browser confirm (`window.confirm`). No server-side guard recorded in the covered code.
23. **AKO picker.** Min 2 characters. At most 5 results. Excludes the current bet and already-selected bets. Only active bets are offered.
24. **AKO reason** is optional and trimmed; empty becomes `null`.
25. **Create tab reset** keeps category, type and live flag (G3).
26. **Dashboard** `Łączna pula` shows `toFixed(0)` with currency `zł`. No thousands separator in the copy.

---

## Edge cases and gotchas

**G1. Superseded definition behind the migration test.** `akoExclusionsMigration.test.ts` checks `FOR UPDATE` before `DELETE FROM public.bet_ako_exclusions` only inside `20260622010000` (the superseded body of `admin_replace_bet_ako_exclusions`). The effective implementation is `private.replace_bet_ako_exclusions` in `20260726102000` (`FOR UPDATE` at line 129, `DELETE` at line 136), called by the public wrapper at line 193. The invariant holds in the effective code, but the test does not check it. The Expo port must not rely on the test to prove the lock. The DB contract test should target the effective definition.

**G2. Refund actions skip confirmation.** The mobile `1.00` button (`ManageBetsTab.tsx:457-458`) and the desktop menu item `Rozlicz 1.00` (lines 541-543) call `resolveBet(bet, [], 'refund')` directly. Refund is a settlement with money effects, and the only confirm is absent. The dialog path has no confirm either (the dialog submit is the confirm).

**G3. Create tab reset is partial.** After a successful create, the form resets title, AKO exclusions, the BSPLICBOOST flag, `endsAt` and options (`CreateBetTab.tsx:154-161`). Options reset to the default shape of the currently selected `betType`, so they are not stale. `categoryId`, `betType` and `isLive` are not reset, so the next bet inherits them.

**G4. No `endsAt` validation message in create.** An empty or invalid date reaches `new Date(endsAt).toISOString()` (line 147), which throws `RangeError` for an invalid date. Whether that throw is inside the `try` was not confirmed. The edit flow has a dedicated message (`Wybierz poprawną datę zakończenia`). Expo should validate the date before the call.

**G5. Validation order and copy differ between create and edit.**
- Create: labels, then option count (`Dodaj co najmniej …`), then odds, then title.
- Edit: AKO loading, AKO failed, title, labels, odds, option count (`Zakład musi mieć minimum …`), date.
- Same rule, different toast copy and order. Decide one order for Expo.

**G6. Glass and blur effects with no perf-lite fallback.** `AdminLayout`'s mobile nav uses `liquid-glass-react` with `displacementScale 46`, `aberrationIntensity 1.35` and related settings. `CreateBetTab`'s sticky bar uses `backdrop-blur-md`. No `usePerfLite` or `html.perf-lite` check exists in the covered files, which AGENTS.md requires for heavy glass or filter effects. Native port: plain background fallback for low-power mode.

**G7. Settlement error is a raw PostgrestError.** `settlementApi.ts` throws the Supabase error object directly. The UI uses `getErrorMessage` on it, but it is not an `Error` instance (unlike `akoExclusions.ts`, which throws `new Error(error.message)`). Expo must handle both shapes.

**G8. Odds fallback differs by function.** `lockOptionsByType` uses `||` with 2 and 3. `lockEditableOptionsByType` uses `??` with `'2'` and `'3'` (strings) and preserves `''`. `normalizeOptions` falls back to `1` for odds not > 0. A missing odds value can therefore become 1 in one path and 2 in another.

**G9. Scroll position is not reset on tab change.** Tabs are state inside one scroll container (`admin-scroll-container`). Switching tabs does not reset scroll in the covered code. AGENTS.md requires layouts that stay mounted across child routes to reset their own scroll. Tabs are not routes, so the rule is not triggered, but the behaviour should be decided.

**G10. Index-based React keys.** `CreateBetTab` option rows use `key={i}` (line ~292). The editor's option rows also use index keys. Edits to option rows (remove in the middle) can mis-associate focus and values in the native port. Use stable local ids per option row.

**G11. Full table loaded and filtered client-side.** `ManageBetsTab` fetches every bet and every category on mount, then filters and slices in memory. Cost grows with the table. There is no refresh after the create tab adds a bet, so the list reloads only when the tab mounts again.

**G12. Dashboard error copy tells the user to refresh.** The inline error (`Odśwież stronę, aby spróbować ponownie.`) has no retry action. Native should provide a retry control.

**G13. Dashboard error and create load are asymmetric.** The dashboard shows an error toast on load failure. The create tab loads categories and active bets silently. Create-tab users see an empty category list with no explanation if the request fails.

**G14. Admin tab state is lost on reload.** No URL per tab. Expo deep links to admin sub-views are impossible without adding routes.

**G15. Moderator mobile bar has one slot.** `mobileTabs` = `availableTabs` for non-admins (`AdminLayout.tsx:190-196`), so moderators get a single `Propozycje` slot and no More sheet. Tests do not assert the moderator bar.

**G16. Nav hide on scroll and the More sheet.** The nav hides on deliberate downward scroll and returns on upward scroll (`getNextScrollChromeState`). A user who scrolls down a long bet list loses the nav until they scroll up. Confirm this is the intended behaviour for Expo.

**G17. Refund and force-lost use the dialog's scope.** Special actions pass `correctionScope` (`ManageBetsTab.tsx:361`), so a refund from the dialog on a new bet uses whatever scope the radio last held (default `pending_only`). Card and menu refunds always use `pending_only`. The two paths can disagree on scope for the same action.

**G18. Delete uses `window.confirm`.** Browser-only API. Expo needs `Alert.alert` or an in-app dialog with the same text: `Czy na pewno chcesz usunąć zakład "{title}"?`.

**G19. Datetime-local input.** Both create and edit use a native `datetime-local` input and `new Date(value).toISOString()`. Expo needs a date-time picker that produces the same local-time value. Timezone assumptions are the device time zone.

**G20. Dashboard money format.** `Łączna pula` uses `toFixed(0)` with no thousands separator. Compare with other money displays in the app before porting.

**G21. Dashboard `recent_activity` limit.** The row count comes from the RPC in `20260610231207_supabase_disk_io_optimization.sql:475`, not re-read. The UI does not cap it.

**G22. Dropdown and dialog nesting.** The `1.00` and delete actions live in a `DropdownMenu` inside the table row, and the editor and resolve dialogs open from the same row. The resolve dialog hides its close button while in progress, so a stuck request traps the user until it completes.

---

## Open questions

- **Q1. Charts.** `DashboardTab` shows only numbers and a list, with no chart library. Confirm that no chart is wanted for the Expo dashboard, or name one.
- **Q2. Unused replace RPC.** `replaceBetAkoExclusions` (and `admin_replace_bet_ako_exclusions` from the client side) has no production callers. Drop the client wrapper, or keep it for the agent path?
- **Q3. Refund without confirm.** Should the Expo port keep the one-tap `1.00` refund (cards and menu) or require confirmation? Both paths settle money.
- **Q4. Refund and force-lost scope.** Should special actions always use `pending_only`, as the card and menu do, or the dialog scope? (G17.)
- **Q5. Full-table loading.** Keep loading every bet and category on mount, or add server pagination to `ManageBetsTab` for Expo?
- **Q6. Deleting a bet with AKO links.** Whether `bet_ako_exclusions` rows cascade on bet delete was not verified in the covered files. Check the schema before porting the delete.
- **Q7. Create date validation.** Confirm the expected message and behaviour for an empty or past end date on create (G4).
- **Q8. Moderator mobile bar.** Confirm a single-slot bar is correct for moderators (G15).
- **Q9. Dashboard refresh.** Add a refresh or retry control (G12)?
- **Q10. Test coverage for the migration.** Should the migration test be rewritten to check the effective `private.replace_bet_ako_exclusions` body (G1)?
