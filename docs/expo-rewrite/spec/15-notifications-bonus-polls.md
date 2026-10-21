# 15. Notifications, bonus campaigns, feature polls (390px phone)

Scope: three overlay-style surfaces as they behave at 390px width in the current Vite app. Desktop (lg, 1024px and up) uses a Radix Popover for the bell; the bonus and poll dialogs are the same at every width.

Polish copy is quoted verbatim. Lucide icon names are given as imported. Literal colors and Tailwind classes are quoted where they carry meaning.

## Files covered

Notifications (`src/features/notifications/`):
- `components/NotificationsBell.tsx` (389 lines)
- `format.ts` (55)
- `sound.ts` (68)
- `unreadCount.ts` (133)
- `api/notifications.ts` (41)

Notifications, shared:
- `src/types/database.ts` (309 total; `NotificationType` at 208-214, `UserNotification` at 264-277)
- `src/components/Navbar.tsx` (bell mounts at 258-262 for desktop nav and 335-340 for the non-desktop nav; lazy import at 29-31; `matchMedia("(min-width: 1024px)")` at 66-69)
- `src/hooks/use-mobile.tsx` (19; `MOBILE_BREAKPOINT = 768`)
- `src/lib/errors.ts` (12; `getErrorMessage`)
- `src/integrations/supabase/rpc.ts` (143; `callRpc` throws `new Error(error.message)`)

Bonus campaigns (`src/features/bonus-campaigns/`):
- `components/bonus-campaign-surface.tsx` (252)
- `bonus-campaign-api.ts` (100)
- `campaign-availability.ts` (115)

Feature polls (`src/features/feature-polls/`):
- `components/feature-poll-surface.tsx` (251)
- `feature-poll-api.ts` (162)
- `poll-availability.ts` (117)
- `types.ts` (60)
- `constants.ts` (18)

Shared UI and mounting:
- `src/components/ui/dialog.tsx` (102; close button unless `hideCloseButton`, line 50; `<span className="sr-only">Close</span>` at line 53; `X` icon)
- `src/components/ui/popover.tsx` (29; default `w-72 rounded-md border bg-popover p-4`, `align="center"`, `sideOffset` 4)
- `src/App.tsx` (208; lazy `BonusCampaignSurface` line 52, `FeaturePollSurface` line 57; authenticated wrappers 91-115 return null unless `user && profile && !loading`; mounted at 144-145 inside `AuthProvider`)
- `src/index.css` (1790; `--mobile-floating-stack-offset: 4.75rem` line 120; `body.mobile-bottom-nav-hidden` override line 239; `.bonus-campaign-cta-visible .coupon-mobile-trigger` lines 702-703)

Migrations:
- `supabase/migrations/20260527021458_harden_notifications_social_rpc.sql` (260): `get_user_notifications` 61, `get_unread_notifications_count` 107, `mark_notification_read` 130, `mark_all_notifications_read` 158. Each checks `auth.uid() IS DISTINCT FROM p_user_id` (lines 75, 117, 142, 169) and raises `Brak dostępu do powiadomień`. REVOKE from PUBLIC and anon (250-253), GRANT to authenticated (256-259).
- `supabase/migrations/20260527020753_enable_social_notifications_realtime.sql` (~272-274): adds `public.user_notifications` to publication `supabase_realtime`.
- `supabase/migrations/20260602120000_bonus_campaigns.sql` (184): `get_available_bonus_campaigns` at 48, `claim_bonus_campaign` at 90, `bonus_campaign_claims` UNIQUE (campaign_id, user_id), GRANTs 183-184.
- `supabase/migrations/20260602120100_fix_claim_bonus_campaign_ambiguity.sql` (94): current claim function body.
- `supabase/migrations/20260614103000_feature_polls.sql` (309): `feature_poll_votes` UNIQUE (poll_id, user_id); CHECK exactly one of option or non-blank other text; `feature_polls_single_active_window_idx ON feature_polls ((is_active)) WHERE is_active = TRUE`; `allow_other BOOLEAN NOT NULL DEFAULT TRUE`.
- `supabase/migrations/20260614104500_feature_polls_copy_and_start.sql` (272): `starts_at` nullable; title/description CHECKs; `get_available_feature_poll` at 32; `submit_feature_poll_vote` at 97; GRANTs 270-271. Does not change the single-active index.

Adjacent tests (listed for coverage; their contents are not summarized here): `NotificationsBell.test.tsx` (286), `format.test.ts` (63), `sound.test.ts` (81), `unreadCount.test.ts` (125), `bonus-campaign-surface.test.tsx` (125), `campaign-availability.test.ts` (96), bonus `constants.test.ts` (17), `feature-poll-surface.test.tsx` (176), `poll-availability.test.ts` (117), poll `constants.test.ts` (23), `featurePollsMigration.test.ts` (114).

---

## Surface A: In-app notifications (bell)

### Entry

- The bell sits in the navbar, lazy-loaded (`Navbar.tsx:29-31`). On non-desktop widths it renders at `Navbar.tsx:335-340`, only when `userId` is set. At 390px the navbar takes the non-desktop branch.
- `NotificationsBell` returns null when `userId` is missing (`NotificationsBell.tsx`, `if (!userId) return null`).
- `useIsMobile()` (`< 768px`) decides the panel type. At 390px the fixed sheet is used, not the Radix Popover.

### Exit

- Clicking a notification closes the panel (`setOpen(false)`) and navigates to `getNotificationLink(notification)`.
- Tapping the full-screen backdrop (`aria-label="Zamknij powiadomienia"`) closes the sheet.
- The bell button toggles the sheet on mobile.
- No Escape handling and no focus trap in the mobile sheet.

### 390px layout

- Bell trigger: `relative inline-flex h-8 w-8 items-center justify-center rounded-full p-0`. Icon `Bell` `h-6 w-6`. Unread state: `text-primary-foreground hover:bg-primary-foreground/20`. Read state: `text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10`.
- Badge (only when `unreadCount > 0`): `absolute -right-1 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 font-bold text-center`. Text is the count, or `99+` above 99.
- Bell `aria-label`: `Powiadomienia` when no unread, otherwise `Powiadomienia, {badge} nieprzeczytane`.
- Backdrop: `fixed inset-0 z-[70] bg-transparent` (a `<button>`).
- Sheet: `role="dialog"`, `aria-label="Powiadomienia"`, `data-testid="notifications-popover-content"`, `data-align="viewport-center"`, class `fixed left-1/2 top-[calc(3.25rem+env(safe-area-inset-top))] z-[80] w-[calc(100vw-2rem)] max-w-[340px] -translate-x-1/2 rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none`. At 390px the width is 340px, centered, with 25px margins.
- Header: `border-b border-border px-3 py-2 flex items-center justify-between`. Title `Powiadomienia` (`text-sm font-semibold`).
- Header actions: sound toggle `rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted`, icon `Volume2` or `VolumeX` `h-4 w-4`. Then `Oznacz wszystkie` (`text-xs text-primary disabled:text-muted-foreground`, disabled when there are no unread items).
- List: `max-h-[380px] overflow-y-auto py-1`.
- Row (a `<button>`, `w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors border-l-2`): left border `border-primary` when unread, `border-transparent` when read.
  - Title: `text-sm font-medium text-foreground line-clamp-2`.
  - Unread dot: `mt-1 h-2 w-2 rounded-full bg-primary shrink-0`, `aria-hidden`.
  - Body (only when present): `text-xs text-muted-foreground line-clamp-2 mt-0.5`.
  - Footer: `mt-1 flex items-center justify-between text-[11px] text-muted-foreground`. Left: type label. Right: relative time.
- No per-type icons. Only `Bell`, `Volume2`, `VolumeX`.

### States

- Loading: `Ładowanie...` (`px-3 py-4 text-xs text-muted-foreground`).
- Empty: `Brak powiadomień` (same classes).
- Error on list fetch: not surfaced in the UI. Failures in the list path are caught by the component and the list stays as it was.
- Count fetch failure: count is reset to `0` (`reconcile` with `count: 0`).

### Copy

| Where | Copy |
|---|---|
| Sheet title | `Powiadomienia` |
| Mark all | `Oznacz wszystkie` |
| Loading | `Ładowanie...` |
| Empty | `Brak powiadomień` |
| Sound on/off aria | `Włącz dźwięk powiadomień` / `Wycisz dźwięk powiadomień` |
| Sound on/off title | `Dźwięk wyłączony` / `Dźwięk włączony` |
| Backdrop aria | `Zamknij powiadomienia` |
| Bell aria, no unread | `Powiadomienia` |
| Bell aria, unread | `Powiadomienia, {n} nieprzeczytane` |

Type labels (`format.ts`):

| `type` | Label |
|---|---|
| `mention_post` | `Wzmianka w poście` |
| `mention_comment` | `Wzmianka w komentarzu` |
| `coupon_won` | `Wygrany kupon` |
| `comment_post` | `Komentarz do posta` |
| `jackpot_draw_ready` | `Losowanie jackpotu` |
| `money_transfer` | `Transfer środków` |
| any other | `Powiadomienie` |

Relative time (`formatNotificationTime`):
- under 1 min: `przed chwilą`
- under 60 min: `{n} min temu`
- under 24 h: `{n} godz. temu`
- under 7 days: `{n} dni temu`
- otherwise: `toLocaleDateString('pl-PL')`

### Interactions

- Tap bell: toggles the sheet on mobile. Also calls `prepareNotificationSound()` if not muted (this resumes a suspended AudioContext on a user gesture).
- Tap sound icon: flips mute, writes localStorage. Unmuting calls `prepareNotificationSound()`.
- Tap an unread row: awaits `markNotificationRead`. On success, decrements count (only if it was unread) and flips the row to read. On failure the error is swallowed. The panel then closes and navigates regardless.
- Tap a read row: closes and navigates.
- Tap `Oznacz wszystkie`: returns early if no unread. Calls `markAllNotificationsRead`, sets count to 0, marks all rows read. Failure is silent (empty catch).
- Opening the panel calls `loadNotifications` (limit 20, offset 0).

### Motion and sound

- No framer-motion or CSS animation on the bell, sheet, or rows beyond `transition-colors`.
- Sound: `playNotificationSound()` on realtime `INSERT`, only when not muted. Web Audio `OscillatorNode` (sine, 880 Hz). Gain ramps `0.0001` to `0.08` over 10 ms, then to `0.0001` at 0.22 s. Oscillator stops at 0.22 s. All errors are swallowed.
- Haptics: none (no `navigator.vibrate` in these files).

---

## Surface B: Bonus campaigns overlay

### Entry

- `BonusCampaignSurface` is lazy-loaded (`App.tsx:52`) and wrapped by `AuthenticatedBonusCampaignSurface` (`App.tsx:91-101`). It renders nothing unless `user && profile && !loading`. It mounts once in `App.tsx` at 144-145 inside `AuthProvider`.
- On load it calls `get_available_bonus_campaigns`. When an active campaign exists and the user has not dismissed the modal in this page session, the modal opens (`setModalOpen(true)` in the effect at 88-93).

### Exit

- `Później` (ghost button) and the dialog close control both call `handleCloseModal`: `modalOpen = false`, `dismissedModal = true`. The floating CTA then appears.
- Successful claim: the campaign is removed from the client list, modal closes, `dismissedModal` resets to `false`.
- The CTA `Odbierz bonus` reopens the modal.

### 390px layout

- Floating CTA (`motion.button`): `fixed bottom-[calc(1rem+var(--mobile-floating-stack-offset,4.75rem)+env(safe-area-inset-bottom))] right-4 z-[70] md:bottom-6 md:right-6 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:brightness-110 transition-[bottom,filter] duration-200 ease-out`.
  - Bottom offset sits above the mobile bottom nav via the CSS variable (4.75rem by default; 0 when `body.mobile-bottom-nav-hidden`).
  - Icon `Gift` `h-5 w-5`. Text `Odbierz bonus` (`text-sm font-bold`). `aria-label="Odbierz bonus"`.
  - Body class `bonus-campaign-cta-visible` is toggled on `document.body` while the CTA shows. CSS at `index.css:702-703` lifts `.coupon-mobile-trigger` to clear it.
- Dialog: `max-w-[28rem]`. Header block: `relative overflow-hidden bg-[linear-gradient(145deg,#d30019_0%,#f0001d_44%,#f43243_100%)] px-6 pb-5 pt-7 text-primary-foreground`, with a diagonal sheen layer `bg-[linear-gradient(115deg,rgba(255,255,255,0)_8%,rgba(255,255,255,0.18)_34%,rgba(255,255,255,0.04)_48%,rgba(255,255,255,0)_70%)]`.
  - `Sparkles` `h-7 w-7` in a motion wrapper.
  - Title and description come from `activeCampaign.title` and `.description` (data, not fixed copy).
  - Amount: `formatBonusAmount(activeCampaign.amount)`.
- Claim button: `h-12 w-full bg-[#e6001a]`, hover `#c90018`.
- Close control: the default dialog X (`X` icon, from `dialog.tsx`) is not hidden. Its sr-only text is English `Close`.

### States

- Hidden: no active campaign, or the modal is open (CTA hidden while modal open).
- Modal open: header plus claim and `Później`.
- Claiming: button shows `Odbieranie...`.
- CTA visible: `isBonusCtaVisible = Boolean(activeCampaign && !modalOpen && dismissedModal)`.

### Copy

| Where | Copy |
|---|---|
| CTA and claim button | `Odbierz bonus` |
| Claiming | `Odbieranie...` |
| Dismiss | `Później` |
| CTA aria | `Odbierz bonus` |
| Success toast | `Odebrano {amount}! Nowe saldo: {balance}` |
| Claim failure fallback | `Nie udało się odebrać bonusu` |
| Load failure fallback | `Nie udało się sprawdzić dostępnych bonusów` |
| Close sr-only | `Close` (English) |

Amount format (`formatBonusAmount`): `Number(amount).toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' zł'`.

### Interactions

- Opening the modal: auto on availability, or via the CTA.
- Claim (`handleClaim`): awaits `claimBonusCampaign(activeCampaign.id)`, then `refreshProfile()`, then removes the campaign from the list, closes the modal, resets `dismissedModal`, fires confetti, shows the success toast.
- Claim failure: error toast (server message when available), then `loadCampaigns()` to refresh the list.
- Confetti (`fireBonusConfetti`, `canvas-confetti`): three bursts. (1) 120 particles, spread 80, origin y 0.55. (2) 60 particles, `startVelocity` 35, origin x 0.2. (3) 60 particles, origin x 0.8.

### Motion

- CTA: `initial`/`exit` `{ opacity: 0, y: 16, scale: 0.95 }`, `animate` `{ opacity: 1, y: 0, scale: 1 }`, inside `AnimatePresence`.
- Sparkles: `initial` `{ rotate: -8, scale: 0.9, opacity: 0 }`, `animate` `{ rotate: [0, -6, 6, 0], scale: 1, opacity: 1 }`, duration 0.7 s, not repeating.
- Amount: `motion.p` with `initial { y: 12, opacity: 0 }`, `animate { y: 0, opacity: 1 }`, `delay 0.15`.
- No reduced-motion or `perf-lite` handling in this surface.
- Haptics: none.

### Sound

- None.

---

## Surface C: Feature polls overlay

### Entry

- `FeaturePollSurface` is lazy-loaded (`App.tsx:57`) and wrapped by `AuthenticatedFeaturePollSurface` (`App.tsx:105-115`). Same mount guard as the bonus surface. Mounted at 144-145.
- On load it calls `get_available_feature_poll`. If a poll comes back, a non-dismissable dialog opens.

### Exit

- Only a successful vote closes it (`setPoll(null)`). There is no close button, Escape, or outside-click dismissal (`hideCloseButton`, `onEscapeKeyDown`, `onPointerDownOutside`, `onInteractOutside` all call `preventDefault`).

### 390px layout

- Dialog: `max-w-[30rem] gap-0 overflow-hidden p-0 shadow-2xl`. At 390px it fills the width with the default dialog margins.
- Inner block: `motion.div` `space-y-5 p-5 sm:p-6`.
- Icon: `flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary` with `Vote` `h-5 w-5`.
- Title: `DialogTitle`, from poll `title`. Fallback `Głosowanie`. If `title_enabled === false` the title is sr-only `Głosowanie`.
- Description: `DialogDescription`, from poll `description`. Fallback `Odpowiedz na jedno pytanie, żeby kontynuować.`. If `description_enabled === false` the text is sr-only `Opis głosowania`.
- Question: `text-base font-semibold leading-snug`, shown unless `question_enabled === false`.
- Option rows: `flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors`. Selected: `border-primary bg-primary/5`. Unselected: `hover:bg-muted/60`. Each is a `Label` wrapping a `RadioGroupItem`.
- `Inne` row: only when `allow_other` is true. Same classes.
- Other panel (`data-testid="feature-poll-other-panel"`): shown when `Inne` is selected. Label `Twoja propozycja`, `Textarea` `id="feature-poll-other-text"`, `rows={3}`. Container animates height 0 to auto.
- Error line: `text-sm font-medium text-destructive`.
- Submit: `Button` `h-11 w-full`. Disabled while `submitting || loadingPoll`.

### States

- Hidden: no user, no profile, or no poll.
- Open, idle: options listed, submit `Oddaj głos`.
- Open, submitting: submit shows `Zapisywanie...` and is disabled.
- Validation error: inline text, no toast.
- Server error: toast, dialog stays open with the selection kept.

### Copy

| Where | Copy |
|---|---|
| Title fallback | `Głosowanie` |
| Description fallback | `Odpowiedz na jedno pytanie, żeby kontynuować.` |
| Hidden title (sr-only) | `Głosowanie` |
| Hidden description (sr-only) | `Opis głosowania` |
| Other option | `Inne` |
| Other panel label | `Twoja propozycja` |
| Validation, nothing selected | `Wybierz odpowiedź` |
| Validation, other empty | `Wpisz swoją propozycję` |
| Submit | `Oddaj głos` |
| Submitting | `Zapisywanie...` |
| Success toast | `Dziękujemy za głos` |
| Load failure toast fallback | `Nie udało się sprawdzić głosowań` |
| Submit failure toast fallback | `Nie udało się zapisać głosu` |

### Interactions

- Select option: sets `selectedValue`, clears the inline error.
- Select `Inne`: opens the textarea panel.
- Submit (`handleSubmit`): validates, then `submitFeaturePollVote({ pollId, optionId | null, otherText | null })`. Other text is trimmed. On success: toast, `setPoll(null)`, reset the form. On failure: error toast, dialog stays open.

### Motion

- Dialog content: `motion.div` `initial { opacity: 0, y: 8 }`, `animate { opacity: 1, y: 0 }`.
- Other panel: `initial`/`exit` `{ height: 0, opacity: 0, y: -4 }`, `animate { height: 'auto', opacity: 1, y: 0 }`, `transition { duration: 0.2, ease: 'easeOut' }`.
- No reduced-motion or `perf-lite` handling. No exit animation on success, because the component returns null before `AnimatePresence` when `poll` becomes null.
- Haptics: none. Sound: none.

---

## Data contract

### Notifications

RPCs (all via `callRpc` from `src/integrations/supabase/rpc.ts`):

| RPC | Args | Called from | Returns |
|---|---|---|---|
| `get_user_notifications` | `p_user_id`, `p_limit` (20), `p_offset` (0) | `fetchUserNotifications`; on panel open and on realtime event while open | `UserNotification[]`, `created_at DESC`, limit clamped 1-100 server-side |
| `get_unread_notifications_count` | `p_user_id` | `fetchUnreadNotificationsCount`; on mount and `userId` change | number |
| `mark_notification_read` | `p_user_id`, `p_notification_id` | `markNotificationRead`; unread row tap | boolean |
| `mark_all_notifications_read` | `p_user_id` | `markAllNotificationsRead`; `Oznacz wszystkie` | number of rows updated |

- Server auth: each RPC is SECURITY DEFINER with `auth.uid() = p_user_id`. EXECUTE granted to `authenticated` only.
- No `.from()` calls in the notifications feature.

Realtime:
- Channel `notifications-${userId}`.
- `postgres_changes`, `event: '*'`, `schema: 'public'`, `table: 'user_notifications'`, `filter: 'user_id=eq.${userId}'`.
- Cleanup: `supabase.removeChannel(channel)` in the effect return.
- Table is in publication `supabase_realtime`.

React Query: not used.

localStorage: `notifications_sound_muted` (`'1'` muted, `'0'` unmuted; missing key means unmuted). Full key prefix in the app is `bsplic.` (per project memory), but this key is written unprefixed, as in the source. Verify before porting.

Table: `user_notifications`. Fields used: `id`, `user_id`, `type`, `title`, `body`, `link_path`, `item_type`, `item_id` (inferred from `getNotificationLink`), `is_read`, `read_at`, `created_at`.

### Bonus campaigns

RPCs:

| RPC | Args | Called from | Returns |
|---|---|---|---|
| `get_available_bonus_campaigns` | none | `fetchAvailableBonusCampaigns`; on load when `user && profile && !loading` | `data ?? []` |
| `claim_bonus_campaign` | `p_campaign_id` | `claimBonusCampaign`; claim button | `data[0] ?? data`; throws `Nie udało się odebrać bonusu` when empty |

- After claim: `refreshProfile()` from `AuthContext`.
- No `.from()` calls in the bonus-campaigns client path. Admin functions are out of scope.
- No realtime, React Query, or localStorage.
- Body class `bonus-campaign-cta-visible` on `document.body` (DOM state only).

### Feature polls

RPCs:

| RPC | Args | Called from | Returns |
|---|---|---|---|
| `get_available_feature_poll` | none | `fetchAvailableFeaturePoll`; on load when `user && profile && !loading` | `data[0]`, options normalized to `{ id, label, sort_order }[]` |
| `submit_feature_poll_vote` | `p_poll_id`, `p_option_id` (or null), `p_other_text` (or null) | `submitFeaturePollVote` | `data[0] ?? data`; throws `Nie udało się zapisać głosu` when empty |

- No `.from()` calls on the user path. Admin path (`admin_get_feature_polls`, `.from('feature_polls')` insert/update, `.from('feature_poll_options')` insert) is out of scope.
- No realtime, React Query, or localStorage.

### Server error text

`callRpc` throws `new Error(error.message)`. The client passes this text to `getErrorMessage(error, fallback)`, so Postgres `RAISE EXCEPTION` messages reach toasts as-is. Known exception texts are listed under Business rules.

---

## Business rules

### Notifications

- Unread count: starts from `get_unread_notifications_count`. Realtime events adjust it through `reduceUnreadCountState`: `INSERT` unread +1; `UPDATE` false to true -1; `UPDATE` true to false +1; `DELETE` unread -1. Clamped at 0. Notification IDs are tracked in Sets, so a local mark-read and its realtime echo do not double count.
- Reconcile on count fetch: sets the count directly. Failure sets it to 0.
- Mark one read: only on unread rows, and only decrements when the row was unread.
- Mark all: local count set to 0 and all rows set read. Server returns the updated count, which is not used.
- Sound: plays on realtime `INSERT` only, and only when not muted. Muted state is per browser (localStorage).
- Navigation: `link_path || '/social'`. When the current path is `/social` and `item_type` and `item_id` are valid, `getSocialItemPath(itemType, itemId)` is used. Any error falls back to the plain link path.
- Panel reloads on realtime events only while open.
- Server: `get_user_notifications` orders by `created_at DESC`, `p_limit` clamped 1-100, `p_offset` at least 0. Mark-read and mark-all return booleans or counts. Access is limited to the caller's own user ID.

### Bonus campaigns

- Availability (server, `get_available_bonus_campaigns`): `is_active`, `starts_at <= NOW() < expires_at`, not claimed by this user. Ordered `starts_at ASC, created_at ASC`. The client takes the first item (`pickFirstAvailableBonusCampaign`).
- Claim (server, `claim_bonus_campaign`): locks the profile row `FOR UPDATE`, rejects inactive, not-yet-started, expired, or already-claimed campaigns, adds `ROUND(balance + amount, 2)` to the balance, and returns `campaign_id`, `amount`, `balance_after`, `claimed_at`.
- Claim error texts (server): `Musisz być zalogowany`, `Nieprawidłowa kampania`, `Nie znaleziono kampanii`, `Kampania nie jest aktywna`, `Kampania jeszcze się nie rozpoczęła`, `Kampania wygasła`, `Nie znaleziono użytkownika`, `Bonus został już odebrany`.
- Dismissal is in-memory only. Closing the modal shows the CTA until a full page reload; a reload reopens the modal for any still-available campaign.
- After a successful claim, `dismissedModal` resets to `false`. If another campaign is available, its modal opens immediately.
- Claim failure triggers a reload of the list, so an expired or already-claimed campaign disappears.

### Feature polls

- Availability (server, `get_available_feature_poll`): `is_active` and `NOW() < expires_at`, not voted on by this user. Ordered `created_at ASC`, `LIMIT 1`. Options returned ordered by `sort_order`.
- Client shows only the first poll (`pickFirstAvailableFeaturePoll`).
- Vote (server): exactly one of option or other text (CHECK). Other text must be non-blank. `allow_other` gates `Inne`. Duplicate vote is blocked by UNIQUE (poll_id, user_id).
- Server exception texts: `Musisz być zalogowany`, `Nieprawidłowe głosowanie`, `Nie znaleziono głosowania`, `Głosowanie nie jest aktywne`, `Głosowanie zakończone`, `Głos został już oddany`, `Nieprawidłowa opcja odpowiedzi`, `Własna odpowiedź nie jest dostępna`, `Wpisz swoją propozycję`.
- Results: admin-only (`admin_get_feature_polls` returns `vote_count`). Users never see counts.
- Non-dismissable: the user must vote to close the dialog. Only a successful vote closes it.
- Load failure: toast, then the surface renders nothing.

---

## Edge cases and gotchas

Notifications:
- The mobile sheet has no Escape handling, no focus trap, and no `aria-expanded` on the trigger. The backdrop is a full-screen button that closes the sheet.
- Mark-read failure is silent, but navigation still happens. Mark-all failure is silent, and the UI is left unchanged.
- Count is reset to 0 on count-fetch failure. That can hide real unread items until the next realtime event or reload.
- Realtime events while the sheet is closed only change the count. The list is refetched on next open.
- `link_path` null falls back to `/social`. Unknown `type` values render as `Powiadomienie`.
- Relative time labels are computed at render. They do not update while the sheet stays open.
- Sound is per browser. Muting on one device does not mute another.
- Sound may be blocked until a user gesture. `prepareNotificationSound` on bell tap and unmute handles this.
- `NotificationsBell` is mounted in two navbar branches. Only one is rendered at a time, based on the 1024px `matchMedia` check.

Bonus campaigns:
- Load effect depends on `loadCampaigns`, which depends on `profile`. A profile refresh (including the one after claim) refetches the campaign list.
- Modal open state is not tied to campaign expiry. If a campaign expires while the modal is open, it stays shown until claim fails.
- After a claim, another available campaign opens its modal immediately, with no pause.
- Dialog close label is English `Close` (sr-only), in an otherwise Polish UI.
- Dismissal does not persist. Reload reopens the modal.
- CTA position depends on `--mobile-floating-stack-offset`. It moves to bottom 0 when `body.mobile-bottom-nav-hidden` is set.
- Confetti runs on every successful claim (`fireBonusConfetti`, `bonus-campaign-surface.tsx:126`).

Feature polls:
- Single-active index: `feature_polls_single_active_window_idx` is on `(is_active) WHERE is_active = TRUE`. A new active poll cannot be inserted while an expired poll still has `is_active = TRUE`. The client availability check uses `expires_at`, not `is_active` alone, so an expired-but-active poll is hidden from users yet still blocks creation.
- Expired while open: a submit returns `Głosowanie zakończone`. The dialog stays open with no path forward except reload. The poll is not refetched after a submit error.
- Duplicate vote while open (e.g. another tab) returns `Głos został już oddany`. The dialog stays open. The poll is not refetched after an error.
- `title_enabled`, `description_enabled`, `question_enabled` default to true when the field is `undefined`, but `false` hides the text and substitutes sr-only labels.
- Selecting `Inne` with empty text shows `Wpisz swoją propozycję` inline. Submit with nothing selected shows `Wybierz odpowiedź` inline.
- Changing the selection clears the inline error.
- Load failure shows a toast and renders nothing. There is no retry control.
- The dialog has no close control, so there is no way to leave without voting, short of reload. Reload brings it back while it is still available.

Shared:
- No `perf-lite` gating or `usePerfLite` in these three surfaces. The bonus CTA and sheet have no infinite animations. The bonus confetti and Sparkles animation run once.
- No reduced-motion handling.
- No haptics anywhere in the three features.
- No React Query. Data is fetched in component effects and held in local state, so these surfaces do not benefit from the boot preload in `src/lib/boot/preload.ts`.

---

## Open questions

1. Desktop scope: does the Popover variant at lg and up need the same copy and sound behaviour checked in the Expo port, or is it out of scope for this spec?
2. Should bonus dismissal persist (for example per session or per campaign) instead of resetting on reload?
3. Should the client recheck bonus `expires_at` while the modal is open, or is claim-time rejection enough?
4. Poll dialog with no escape hatch: is there a required path after repeated submit failure, or after a poll expires while open?
5. Should a failed submit (expired, duplicate) refetch the poll, so the dialog closes or shows the right state?
6. Should `feature_polls` auto-deactivate expired polls before a new one is created, given the single-active partial index?
7. Mobile sheet accessibility: is Escape close, focus trap, and `aria-expanded` required for the Expo port?
8. Silent mark-read and mark-all failures: should they surface a toast, or is silence intended?
9. Relative timestamps: should they refresh while the sheet is open?
10. Bonus close label: should the sr-only `Close` be translated to Polish?
11. Notification sound: is the 880 Hz blip the intended sound on native, or should it use the platform notification sound?
12. Should the bell and sheet reflect `item_type`/`item_id` navigation on non-`/social` pages, or is the current `/social`-only rewrite intended?
