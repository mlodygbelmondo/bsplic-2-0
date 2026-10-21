# Worker brief — BSPLIC native rewrite

You implement one area of the native app in `mobile/` with 1:1 parity to the PWA at phone size (below 1024 px). Several workers run in parallel in the same checkout, each owning disjoint files. The orchestrator integrates, runs the simulator and commits.

## Read first

1. `.ai/docs/expo-migration-contract.md` (binding scope and rules).
2. This brief.
3. Your specs in `docs/expo-rewrite/spec/` (named in your task), plus `01-shell-boot-theme.md` (tokens, theme) and `19-data-contract.md` (RPCs, tables).
4. The web source the specs point to. **The web source is the reference implementation**; specs can be incomplete or wrong. Read the real components, styles (Tailwind classes, CSS files, `src/index.css`) and tests for every surface you build.

## Ownership

- Edit only the files and folders your task lists. Creating new files inside your folders is fine.
- Never edit: `mobile/package.json`, lockfiles, `mobile/app.json`, `mobile/src/app/_layout.tsx`, `mobile/src/app/(tabs)/_layout.tsx`, `mobile/src/theme/*`, `mobile/src/lib/*`, `mobile/src/ui/*`, other workers' folders, anything outside `mobile/`.
- Need a shared change (new dependency, sheet detents, a `ui` primitive fix, a token, a cross-feature hook)? Work around it locally and list it under **Needs** in your final report. Do not install packages.
- Files marked `SCAFFOLD` that your task assigns to you: replace them, keeping the export name and props. Files marked `SCAFFOLD` owned by others: import them as they are.
- Route files in `mobile/src/app/` stay thin: they import a screen component from your feature folder and render it. Delete `RoutePlaceholder` usage in the routes you own.

## No git, no devices

- Do not run git commands that change state (`commit`, `checkout`, `stash`, `reset`, `add`). Read-only `git diff`/`git status` is fine.
- Do not start simulators, Metro, browsers or Xcode builds (host RAM). The orchestrator runs them.
- Never print or commit secrets; `.test-credentials.local.md` and `mobile/.env.local` stay unread.
- Never write to the production database from scripts. No SQL migrations unless your task says so.

## Checks (run from `mobile/`)

- Typecheck your files: `npx tsc --noEmit 2>&1 | grep -E "<your paths regex>"` (other workers' in-progress errors are not yours). Run it a few times, not after every edit — several workers share the machine.
- Lint: `npx eslint <your folders and route files>`.
- Pure logic ported from the web keeps its tests: copy the web test next to the ported module, adapt imports, run `npx vitest run <path>`. Follow the testing rules in the root `AGENTS.md` (no tautological tests).
- Finish with zero type errors and zero lint errors in your paths.

## Foundation you build on (read these files before writing code)

- `@/theme` — `createStyles(palette => styles)` (the only way to style), `useTheme()`, `useScheme()`, `palettes`, `alpha()`, `hsl()`, `text` scale, `fonts`. Tokens are exact ports of the web CSS variables for both themes: `colors`, `gradients` (CSS-string `backgroundImage`), `shadows` (`boxShadow` strings), `radius`. `socialMobileColors` for the phone Social palette, `brand` for casino/splash gold and red.
- `@/ui` — `Text` (size = Tailwind size key, weight, color token, italic, tabular), `Button` (web variants and sizes), `PressScale`, `Surface`, `Skeleton`, `BrandSpinner`, `SectionLoader`, `StateMessage`, `Badge`, `Avatar`, `ScreenBackground`, `Glass`, `SheetHeader`, `Field`.
- `@/lib/supabase` (typed client), `@/lib/rpc` (`callRpc` with typed contracts), `@/types/database`, `@/types/social`, `@/lib/database.types`.
- `@/lib/query-client` — `queryClient`, `PAGE_DATA_QUERY_OPTIONS` (cached data shows instantly, refreshes in the background), `NON_PERSISTED_QUERY_ROOTS` (query key roots `roulette-live`, `blackjack-live`, `jackpot-live`, `slots-live` are never persisted — use them for live server state).
- `@/lib/realtime` — `useRealtimeChannel(name, configure, { enabled, onSubscribed })`: open only while the screen is focused and the app active, removed on blur/background/unmount. Refetch in `onSubscribed`.
- `@/lib/focus` — `useHasBeenFocused()` (gate tab-root queries/images: NativeTabs mounts every tab eagerly), `useScreenActive()`, `useAppActive()`.
- `@/features/boot/boot-store` — `useBootHold(active)`: hold the boot overlay while the first screen's data loads (only the focused screen holds). `SectionLoader` holds automatically.
- `@/features/auth/auth-store` — selectors `useUser`, `useUserId`, `useProfile`, `useBalance`, `useIsAdmin`, `useIsModerator`; `authActions.refreshProfile()`, `authActions.updateProfileBalance(n)`.
- `@/features/coupon/coupon-store` — `couponActions` (`addItem` toasts "Dodano do kuponu", `addItems`, `removeItem`, `clearCoupon`, `setPreferredCouponType`), selectors `useCouponItems`, `useCouponCount`, `useCouponTotalOdds`, `useCouponSelection(betId)`.
- `@/lib/preferences` — theme, `casinoSound`, `notificationSound`.
- `@/lib/connectivity` — `useIsOffline()`, `OFFLINE_WRITE_MESSAGE`. Disable wagering, casino, money, social and admin writes while offline and show that message; never queue writes.
- `@/lib/motion` — `useLiteMotion()` (reduced motion or Low Power Mode): stop decorative infinite animations, drop heavy blur/glass.
- `@/lib/haptics`, `@/lib/toast` (`toast` from sonner-native: same text, ids and durations as the web), `@/lib/format` (`formatMoney`, `formatOdds`, `pluralPl`), `@/lib/errors` (`getErrorMessage`), `@/lib/sheet-options`.
- `@/features/shell/AppHeader` — `<AppHeader back? />`, the mobile navbar. Every signed-in screen renders it at the top, outside its scroll view (`back` on pushed screens: public profile, social item, replay, admin).

## Implementation rules

- **Parity**: same features, rules, data, Polish copy (verbatim, including toasts, empty/error states and accessibility labels), layout, spacing, font sizes, colors, radii, gradients, shadows, icons (`lucide-react-native`, same icon names as the web), motion character. Port both themes; the default is light. Translate Tailwind classes faithfully (`p-3` = 12, `text-sm` = 14/20, `rounded-xl` = 12, etc.).
- **Native where it is better**: native stacks, form sheets (`router.push('/sheets/...')`), `Alert`/`ActionSheetIOS` or `@expo/ui` menus for confirms and dropdowns, pull-to-refresh (`RefreshControl`) where the web refreshes data, haptics on selections and outcomes, swipe gestures where the web has swipe/drag. Do not redesign.
- **Data**: TanStack Query with query factories in your feature's `api/` (`queryOptions({ queryKey, queryFn, ...PAGE_DATA_QUERY_OPTIONS })`), explicit error checks (`if (error) throw error`), `select` to subscribe narrowly. Seed detail screens from list caches where possible and prefetch on press-in for instant navigation. Mutations: check errors, update the cache, toast like the web. Live game/draw state never comes from the persisted cache.
- **Lists**: `@shopify/flash-list` v2 (`FlashList`, no `estimatedItemSize`), stable `keyExtractor` from ids, memoized rows, `expo-image` with fixed sizes and `recyclingKey`.
- **Motion**: Reanimated 4 on the UI thread. Shared values via `.get()`/`.set()` (never `.value`, the React Compiler lint rejects it). Call JS from worklets with `scheduleOnRN` from `react-native-worklets` (not `runOnJS`). No JS timers driving visual motion; timers for game logic are fine. Resume from server state on foreground; never assume an animation kept running in the background.
- **Graphics**: Skia for wheels, conic gradients, confetti, charts, posters and glows views cannot do. Skia 2.14 paths are immutable: build with `Skia.PathBuilder.Make()…build()`. RN 0.88 views support `backgroundImage` (linear/radial gradient CSS strings), `boxShadow` (incl. inset), `filter`, `mixBlendMode`.
- **React 19**: `ref` is a regular prop (`ref?: Ref<…>`), no `forwardRef`. React Compiler is on: no manual `useMemo`/`useCallback` unless needed for a non-React consumer; follow the hooks lint.
- **TypeScript**: no `any`; narrow casts for Supabase rows; reuse `@/types/database`.
- **Keyboard**: `react-native-keyboard-controller` (`KeyboardAwareScrollView`, `KeyboardStickyView`, `KeyboardAvoidingView`).
- **Accessibility**: labels on icon buttons (web `aria-label` text), 44 pt hit targets (`hitSlop` where the visual is smaller), `accessibilityRole`, Dynamic Type must not break layouts (`Text` caps at 1.35×).
- **Assets**: web images from `public/` are in `mobile/assets/images/` (casino, jackpot, badges, maintenance). If you need another asset from `public/`, copy it into `mobile/assets/images/<area>/` and list it in your report.
- **Performance**: no inline object styles in hot rows, no context that re-renders the tree, zustand selectors, `React.memo` rows where props are stable.

## Platform pitfalls found on the simulator

- **Form sheet roots**: give the outermost view of every `/sheets/*` screen `collapsable={false}`. Otherwise react-native-screens (iOS 26, Fabric) finds the ScrollView directly in the sheet and places it at the top, over the header.
- **Animated components never get function styles**: an `Animated.createAnimatedComponent(Pressable)` with `style={({ pressed }) => …}` loses `backgroundImage` and `boxShadow`. Use `PressScale` from `@/ui` (it resolves pressed styles itself) or a plain `Pressable`.
- **Italics**: iOS does not synthesize italics for Inter. Use `Text italic` or `fauxItalic` from `@/theme`, never `fontStyle: 'italic'`.
- **Realtime**: `useRealtimeChannel` gives every subscription a unique topic; fixed names are fine.
- **Worklet default parameters**: a worklet does not capture module constants used in default parameter values (`perspective = DRUM_PERSPECTIVE` crashes on the UI thread). Resolve defaults inside the body.
- **Dialog close buttons**: the shadcn `data-[state=open]:bg-accent` on `DialogPrimitive.Close` never applies on the web (the button has no `data-state`); do not give native close buttons a background.

## Final report (your last message)

Keep it short and factual:

1. **Files** created or replaced.
2. **Done**: surfaces implemented, mapped to spec sections.
3. **Partial / not done**, with the reason.
4. **Needs** from the orchestrator (shared changes, dependencies, sheet options, root-layout mounts, assets).
5. **Check results**: tsc (your paths), eslint, vitest.
6. **QA notes**: what the orchestrator should exercise on the simulator, and the web screens to compare.
