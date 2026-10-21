# Auth spec: BSPLIC 2.0 web app, for the Expo rewrite

Scope: sign-in, registration, forgot password, password reset, session bootstrap, sign-out. Layout is at 390px. In auth files the only breakpoints are `sm:` (640px+: card padding p-8, title text-2xl) and `md:` (768px+: `md:justify-center`). Neither applies at 390px. There are no `lg:` rules in auth files.

## Files covered

- /Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/contexts/AuthContext.tsx: 236 lines
- /Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/components/LoginPage.tsx: 260 lines
- /Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/components/AuthModal.tsx: 141 lines (dead code, not ported)
- /Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/pages/ResetPasswordPage.tsx: 154 lines
- /Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/integrations/supabase/client.ts: 24 lines (generated/bootstrap, do not edit)
- /Users/piotr/.t3/worktrees/bsplic-2-0/expo-native-rewrite/src/lib/errors.ts: 12 lines

Supporting reads (context only): `src/App.tsx` (routes, AuthenticatedRoute), `src/pages/Index.tsx`, `src/index.css` (tokens, `.auth-shell`, `.gradient-primary`, `.h-safe-screen`, `.safe-pad-y`), `src/types/database.ts` (Profile), `src/integrations/supabase/types.ts`, `supabase/migrations/20260313132000_22d7a7b6-3328-4845-a764-8c69af8f08f5.sql`, `src/components/Navbar.tsx`, `src/components/NavbarMobileMenu.tsx`, `src/components/ui/{dialog,input,button,label}.tsx`, `src/hooks/usePageTitle.ts`, `package.json`, `supabase/config.toml`.

## Surfaces

### 1. Login, register and forgot password (`LoginPage`, one component, three views)

- Entry: `/` when there is no user (`src/pages/Index.tsx`, `!user` branch). Also any AuthenticatedRoute-wrapped route when there is no user (`src/App.tsx`).
- Exit: successful sign-in, or sign-up that returns a session, sets `user` in AuthContext and the app renders the authenticated home. Sign-up without a session stays on the register view. Forgot success stays on the forgot view.
- State: `view: "login" | "register" | "forgot"` (default login). `email` is initialised from localStorage `bsplic.auth.last-email` and is shared by all views. `password`, `username`, `showPassword` and `loading` are local. Switching views does not clear `password` or `username`.

Login view, top to bottom:

1. Root `div`: `h-safe-screen safe-pad-y auth-shell relative overflow-y-auto flex flex-col items-center justify-start px-4`. Full height (100svh, or `--app-viewport-height`). Vertical padding is 1rem plus the safe-area inset. Horizontal padding 16px. Scrolls if taller than the screen.
2. Decoration `div`: `absolute inset-0 overflow-hidden pointer-events-none`, `aria-hidden`, class `auth-background-decoration`. Static, no blur, no animation.
3. Wordmark `h1`: "BSPLIC 2.0". `text-4xl` (36px) `font-black` `tracking-tight` `text-primary-foreground`. Wrapper `relative z-10 mb-8` (32px below).
4. Card: `relative z-10 w-full max-w-sm` (358px at 390px wide). Inner `bg-card rounded-2xl shadow-2xl p-6` (24px padding).
5. Title `h2`: "Zaloguj się" (register: "Zarejestruj się"). `text-xl sm:text-2xl font-bold text-center text-card-foreground mb-5`.
6. Form, `space-y-3` (12px gaps):
   - Register only, username field: label "Nazwa użytkownika", input type text, placeholder "Twój nick", `required`.
   - Email field: label "E-mail", input type email, placeholder "twoj@email.pl", `required`.
   - Password field: label "Hasło", input type password (type text when shown), placeholder "••••••••", `required`, `minLength={6}`. Toggle button on the right: `ml-2 text-muted-foreground`, `Eye` icon when hidden and `EyeOff` when shown, `h-5 w-5`. No aria-label.
   - Field wrapper for each field: `bg-muted rounded-xl px-4 pt-2.5 pb-2` (radius 12px, padding 16px sides, 10px top, 8px bottom). Label: `block text-xs text-muted-foreground mb-0.5` (12px, 2px gap). Input: `w-full bg-transparent text-foreground text-base font-medium outline-none` (16px). Labels are not linked to inputs (no htmlFor).
   - Submit: native `button`, `w-full h-11 rounded-xl text-base font-bold gradient-primary text-primary-foreground shadow-lg hover:brightness-110 transition` (44px tall). Label "Zaloguj się" / "Zarejestruj się", or "Ładowanie..." while loading (disabled).
7. Login only: "Nie pamiętasz hasła?" button below the form (`mt-4 w-full text-center text-sm font-semibold text-primary hover:underline`). Switches to forgot view.
8. Footer below the card, `text-center mt-5`. Login: text "Chcesz otworzyć nowe konto?" (`text-sm text-primary-foreground/70`) then button "Zarejestruj się" (`font-bold text-sm text-primary-foreground hover:underline mt-1`). Register: "Masz już konto?" and "Zaloguj się".

Register view: same stack with the username field added, title "Zarejestruj się", submit "Zarejestruj się", no forgot link, footer swapped.

Forgot view: same root, wordmark and card, with different card content:
- Back button: `flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors`. `ArrowLeft` icon `h-4 w-4`. Label "Wróć do logowania". Goes to login view.
- `h2` "Nie pamiętasz hasła?" (`text-xl sm:text-2xl font-bold text-center text-card-foreground mb-2`).
- `p` "Wpisz swój adres e-mail, a wyślemy Ci link do resetowania hasła." (`text-sm text-muted-foreground text-center mb-5`).
- Form `space-y-3`: email field (same styling and placeholder). Submit "Wyślij link", or "Wysyłanie..." while loading, same button classes, disabled while loading.
- No footer below the card.

Interactions:
- Login submit: `signIn(email, password)`, then `writeLastEmail(email)`, then toast success "Zalogowano pomyślnie!". Error: toast `err.message` if `err instanceof Error`, else "Wystąpił błąd".
- Register submit: `signUp(email, password, username)`, then `writeLastEmail(email)`. If no session: toast "Konto utworzone! Sprawdź email, aby potwierdzić konto." and the form stays as it is. If session: toast "Konto utworzone i zalogowano automatycznie!". Error handled as above.
- Forgot submit: if email is empty, toast "Wpisz swój adres e-mail" and no request. Otherwise `resetPassword(email)`, then toast "Link do resetowania hasła został wysłany na Twój e-mail!". Stays on the forgot view, email still filled. No cooldown. Error handled as above.
- Eye toggle affects the password field only.

Motion: none beyond CSS `transition` on hover and colour. No framer-motion. Toasts use sonner.
Images: none. All visuals are CSS gradients.
Icons (lucide-react): `Eye`, `EyeOff` (h-5 w-5), `ArrowLeft` (h-4 w-4).

### 2. Reset password (`ResetPasswordPage`, route `/reset-password`)

- Route: `src/App.tsx:197`, outside AuthenticatedRoute, so it renders for logged-in and logged-out users alike. Lazy chunk via `loadResetPasswordPage` (`src/lib/boot/route-modules.ts:13`). Title via `usePageTitle("Reset hasła")`, so `document.title` is "Reset hasła — BSPLIC 2.0".
- Entry: link from the reset email, shaped like `…/reset-password#access_token=…&type=recovery…`.
- Recovery detection: on mount, `window.location.hash.includes("type=recovery")` sets recovery view. Also subscribes to `onAuthStateChange` and sets recovery view on event `PASSWORD_RECOVERY`.
- Exit: successful update, toast "Hasło zostało zmienione!", then `navigate("/")`. The recovery session is the active session, so there is no second login. In the invalid-link state, "Otwórz logowanie" calls `navigate("/")`.

Invalid-link state (not recovery). Root `h-safe-screen safe-pad-y gradient-primary flex items-start md:items-center justify-center px-4 overflow-y-auto`. Card `bg-card rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-sm text-center`, no wordmark.
- `h2` "Nieprawidłowy link" (`text-xl font-bold text-card-foreground mb-3`).
- `p` "Wróć do logowania i wyślij nowy link resetowania." (`text-sm text-muted-foreground mb-5`).
- shadcn Button (default variant, `h-10 rounded-md`) with classes `gradient-primary text-primary-foreground font-bold`, label "Otwórz logowanie".

Recovery view. Root `h-safe-screen safe-pad-y gradient-primary relative overflow-y-auto flex flex-col items-center justify-start px-4`. This is a solid primary gradient, not `auth-shell`, and has no decoration.
- Wordmark `h1` "BSPLIC 2.0" (`text-4xl font-black text-primary-foreground tracking-tight mb-8`).
- Card `w-full max-w-sm`, `bg-card rounded-2xl shadow-2xl p-6`.
- `h2` "Ustaw nowe hasło" (`text-xl sm:text-2xl font-bold text-center text-card-foreground mb-2`).
- `p` "Wpisz nowe hasło do swojego konta." (`text-sm text-muted-foreground text-center mb-5`).
- Form `space-y-3`:
  - Field "Nowe hasło" (label htmlFor `new-password`, input id `new-password`, placeholder "••••••••", `required`, `minLength={6}`). Wrapper is the same field style with a flex row and an eye toggle (`ml-2 text-muted-foreground`, `h-5 w-5`) with aria-label "Pokaż hasło" / "Ukryj hasło".
  - Field "Potwierdź hasło" (label htmlFor `confirm-password`, input id `confirm-password`, same type as the first field, placeholder "••••••••", `required`, `minLength={6}`). No toggle; it follows the shared toggle.
  - Match line, shown only when the confirm field is non-empty: `text-xs font-semibold`. "Hasła są zgodne" in `text-success` (hsl 150 62% 48%), or "Hasła nie są takie same" in `text-destructive` (hsl 0 84% 60%).
  - Submit: shadcn Button, `w-full h-11 rounded-xl text-base font-bold gradient-primary text-primary-foreground shadow-lg hover:brightness-110 transition`. Disabled when `loading || password.length < 6 || password !== confirmPassword`. Shadcn adds `disabled:opacity-50`. Label "Zmień hasło", or "Zapisywanie..." while loading.
- Submit handler: `supabase.auth.updateUser({ password })`. Success toast "Hasło zostało zmienione!" then `navigate("/")`. Error toast `err.message` if Error, else "Wystąpił błąd".
- The two guard toasts "Hasła nie są takie same" and "Hasło musi mieć co najmniej 6 znaków" are unreachable in practice, because the disabled submit blocks them.

### 3. AuthModal (`src/components/AuthModal.tsx`): dead code

- No import anywhere in `src`. Not a surface. Do not port.
- For reference only: a dialog version with the same login and register fields, no forgot link, aria-labels on the eye toggle, and closes on success.

### 4. Sign-out triggers (not auth surfaces, they call `signOut`)

- Desktop: `src/components/Navbar.tsx:314`, `DropdownMenuItem` with `LogOut` icon (`mr-2 h-4 w-4`), label "Wyloguj".
- Mobile: `src/components/NavbarMobileMenu.tsx:172-176`, label "Wyloguj się". `handleSignOut` (line 54) closes the sheet, then calls `void signOut()`.

### 5. Boot gate (not a surface, decides which surface shows)

- `AuthProvider` starts with `loading = true`. Index and AuthenticatedRoute show `BrandedLoader` while loading. `BrandedLoader` holds the splash (AGENTS.md).
- AuthenticatedRoute (`src/App.tsx`) shows the loader when `loading || (user && !profile)`, and LoginPage when there is no user. See gotcha 1.

## Data contract

### Client (`src/integrations/supabase/client.ts`)

- `createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { storage: localStorage, persistSession: true, autoRefreshToken: true, lock: bypassAuthWebLock } })`.
- `bypassAuthWebLock = (_name, _acquireTimeout, fn) => fn()` (Web Locks API disabled).
- Expo: `storage` must become an async adapter (secure or async storage). `lock` is web-only.

### Auth calls

| Call | Used in | Options | Result used |
|---|---|---|---|
| `auth.getSession()` | AuthContext bootstrap | none | `data.session`; on error, `applyAuthSession(null)` |
| `auth.onAuthStateChange(cb)` | AuthContext (all events); ResetPasswordPage (`PASSWORD_RECOVERY` only) | none | subscription, unsubscribed on unmount |
| `auth.signInWithPassword({ email, password })` | `signIn` | none | throws on `error` |
| `auth.signUp({ email, password, options: { data: { username } } })` | `signUp` | no `emailRedirectTo` | `requiresEmailConfirmation = !data.session` |
| `auth.signOut()` | `signOut` | none passed | then `clearProfileState()` |
| `auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })` | `resetPassword` | `redirectTo` | throws on `error` |
| `auth.updateUser({ password })` | ResetPasswordPage submit | none | throws on `error` |
| `auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })` | `signInWithMagicLink` | `emailRedirectTo` | no UI caller (unused) |

Events handled: AuthContext reacts to every event (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED and others). ResetPasswordPage reacts only to `PASSWORD_RECOVERY`.

### Data queries (AuthContext `fetchProfile(userId)`)

Runs after each auth event that has a user. Deduped in flight per `userId`. Run in parallel with `Promise.all`:
- `from('profiles').select('*').eq('id', userId).single()`. Returns `data: Profile | null` (cast from the row). The `error` is not checked. Fields: `id`, `username`, `avatar_url` (string | null), `balance` (number), `current_streak`, `longest_streak`, `last_bet_date` (string | null), `last_topup_at` (string | null), `created_at` (string). Source: `src/types/database.ts` and `src/integrations/supabase/types.ts`.
- `from('user_roles').select('role').eq('user_id', userId)`. Returns `data: { role: 'admin' | 'moderator' | 'user' }[] | null`. The `error` is not checked. `isAdmin` = some row is `admin`. `isModerator` = some row is `moderator`.
- No `.rpc()` in auth code. No realtime subscription in auth code.

### Database objects (from the initial migration)

- `profiles`: columns as above. `balance` defaults to 500. RLS: SELECT for everyone; INSERT and UPDATE only on own row.
- `user_roles`: `id`, `user_id`, `role` (enum `app_role`: `admin`, `moderator`, `user`).
- Trigger `handle_new_user` on `auth.users`: inserts a `profiles` row with `username = COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1))`, and a `user_roles` row with role `user`. The web client never inserts profiles.

### localStorage

- `bsplic.auth.last-email`: plaintext email. Written after successful login or register (not forgot). Read once on LoginPage init. Not cleared on sign-out.
- Supabase session (default key `sb-<project-ref>-auth-token`, implied by `persistSession` and `storage: localStorage`, not checked in code). Written and refreshed by supabase-js.

## Business rules

1. Login is email plus password. No username login.
2. Register takes username, email and password. The username goes into user metadata. The DB trigger creates the profile (balance 500) and the `user` role. The client does not trim the username and does not check uniqueness.
3. If the project requires email confirmation, sign-up returns no session. The user must confirm by email, then log in manually. The app shows only a toast.
4. Password must be at least 6 characters. This is enforced by the browser (`minLength`) on login, register and reset. There are no other client rules. The server policy is set in the Supabase dashboard.
5. Forgot password requires a non-empty email (JS check, plus browser `type=email`). The reset link returns to `${origin}/reset-password`.
6. A reset link is valid only when the URL hash has `type=recovery` or the `PASSWORD_RECOVERY` event fires. The new password must be at least 6 characters and match. On success the user is sent to `/` already logged in.
7. Session persists in localStorage and auto-refreshes. The user stays logged in across launches until sign-out or a failed refresh.
8. Sign-out calls `supabase.auth.signOut()`, then clears profile, admin and moderator state. Clearing the React Query cache is a project convention (AGENTS.md), not done in auth files.
9. `isAdmin` gates the admin surface (`AdminLayout`, `BootController`). `isModerator` is read only by `AdminLayout`.
10. A signed-in user with no profile is held on the loader (see gotcha 1).
11. Bootstrap: `loading` stays true until the first auth signal (`getSession` or an auth event). After 6000 ms with no signal, the app shows the logged-out UI.

## Edge cases and gotchas

1. Profile and role errors are silent. supabase-js returns `{ error }` rather than throwing, and the code ignores `error` on both queries. A missing profile row or a failed query leaves `profile = null` and roles as `[]` (`isAdmin` false). The `.catch` only fires on thrown exceptions. With the gate in Surface 5, a signed-in user whose profile read fails sits on the loader forever, with no retry and no sign-out. Decide on retry, an error screen, or sign-out.
2. Bootstrap timeout is 6000 ms. If no auth event arrives in time, the logged-out UI shows even if a stored session exists. A later session still wins, because `applyAuthSession` runs again on later events or `getSession`.
3. Profile fetch is deferred. `applyAuthSession` schedules `fetchProfile` with `setTimeout(0)`, so `user` is set before `profile`, and the gate shows the loader in between. A `profileRequestIdRef` guard discards results that arrive after sign-out or a newer fetch.
4. `signOut` has no try/catch. If `supabase.auth.signOut()` rejects, `clearProfileState()` does not run and the error reaches the caller. Check each call site (Navbar, mobile menu uses `void`, so the rejection is unhandled).
5. `signOut()` passes no options. supabase-js v2 is believed to default to global scope (all devices). Verify in `node_modules/@supabase/auth-js` before porting.
6. Supabase error text is shown raw. `AuthError` extends `Error`, so toasts show English Supabase messages (for example "Invalid login credentials" or "Email not confirmed"). Nothing maps them to Polish. `getErrorMessage` in `src/lib/errors.ts` is unused by auth.
7. Known Supabase behaviour (not verified for this project): with confirmation on, sign-up for an already-registered email returns no error, so the "check your email" toast shows anyway.
8. Register keeps all field values after success. With confirmation required, the user stays on the register view.
9. `required` accepts whitespace-only usernames. No trim, no max length, no uniqueness check in the client. The migration read did not show a unique constraint on `profiles.username`.
10. Login also enforces `minLength` 6 in the browser, so an account with a shorter password cannot log in through this form.
11. Browser validation is the only form validation. Native has no equivalent. Reproduce: non-empty fields, email shape, password of at least 6 on login, register and reset, and the reset submit disabled until valid.
12. The forgot view and login view share `email`. Password and username persist across view switches.
13. No rate-limit UI or cooldown on forgot. Supabase rate-limit errors appear raw.
14. Recovery race: the page reads `window.location.hash` on mount and also listens for `PASSWORD_RECOVERY`. If supabase-js has already consumed the hash, or the event fires before the lazy chunk subscribes, a valid link shows "Nieprawidłowy link". Not verified against auth-js. Test on a cold load with a real link. The route is not preloaded for logged-out users (AGENTS.md), so the chunk loads only after the link opens.
15. Expired or used recovery links: Supabase puts error params in the hash and drops `type=recovery`, so the page shows "Nieprawidłowy link" (inferred from code, not tested).
16. A logged-in user opening `/reset-password` without a recovery hash sees "Nieprawidłowy link".
17. Reset success does not revoke other sessions. No code does this.
18. Native redirects: web uses `window.location.origin` and `/reset-password`. The native app needs a deep link. `signUp` sends no `emailRedirectTo`, so confirmation links use the dashboard Site URL.
19. Native parsing: `detectSessionInUrl` must be off on native. The app must parse recovery tokens from the deep link itself, because the hash-based flow does not apply.
20. Accessibility: LoginPage labels are not linked to inputs, and the login eye toggle has no label. ResetPasswordPage links labels and labels its toggle. Native needs `accessibilityLabel` on the toggles.
21. `refreshProfile` is not memoised, and it does nothing when `user` is null. `updateProfileBalance` changes only the local balance.
22. Light theme: `.light .auth-shell` replaces the dark gradient with `linear-gradient(135deg, hsl(355 100% 50%), hsl(355 85% 39%))`. Light values for card and muted were not captured here.

## Open questions

1. Hosted Supabase Auth settings are not in the repo (`supabase/config.toml` has no `[auth]` section). Need an export of: email confirmation on or off, Site URL, redirect allow-list (must include the web origin with `/reset-password` and the native deep link), password policy, OTP and recovery link expiry, rate limits, and whether sign-up is open.
2. What is the native deep-link scheme for reset and confirmation? Which redirect URL should the app use?
3. On a profile read failure for a signed-in user, should the app retry, show an error screen, or sign out? (See gotcha 1.)
4. Should Supabase English error messages be mapped to Polish? Currently they show verbatim.
5. Is `profiles.username` unique in the database? Only the initial migration was read.
6. Is `handle_new_user` unchanged in later migrations? Only the initial migration was checked.
7. Does the recovery race (gotcha 14) happen on a cold load? Needs a browser test with a real recovery link.
8. Is `signOut()` global or local scope in the pinned `@supabase/auth-js`? Check the installed version.
9. Light-theme card, muted and foreground values for the auth screens (`.light` block in `src/index.css`) were not captured.
10. Is the magic-link API (`signInWithMagicLink`) wanted in the native app? It exists in context with no UI. Current recommendation: do not port.
