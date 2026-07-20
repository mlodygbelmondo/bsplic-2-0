# BSPLIC 2.0 mobile

Natywna aplikacja Expo Router korzystająca z tego samego produkcyjnego projektu Supabase co aplikacja Vite/PWA. Wiążącym zakresem migracji jest [`../.ai/docs/expo-migration-contract.md`](../.ai/docs/expo-migration-contract.md), a aktualny stan prac opisuje [`../.ai/docs/expo-migration-status.md`](../.ai/docs/expo-migration-status.md).

## Konfiguracja lokalna

W katalogu `mobile/` utwórz lokalny plik `.env` (nie commituj go):

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=public-anon-key
EXPO_PUBLIC_WEB_URL=https://bsplic.vercel.app
```

Wartości dwóch pierwszych zmiennych odpowiadają `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` z aplikacji webowej.

```bash
npm install
npm run ios
```

Rejestracja i magic link celowo nie występują. Logowanie korzysta z istniejącego konta email/hasło. Do ręcznego QA użyj ignorowanych poświadczeń opisanych w głównym `AGENTS.md`; nigdy nie zapisuj ich w tym katalogu.

## Kontrole

```bash
npx tsc --noEmit
npm run lint
npx expo-doctor
npx expo export --platform ios
npx expo export --platform android
```

Android jest wspieranym celem, ale zgodnie z umową migracji podczas nocnego przebiegu nie uruchamiamy emulatora Androida.

## Linki i wydanie

Aplikacja ma scheme `bsplic`, iOS bundle identifier oraz Android package `pl.bsplic.app`, a web fallback `https://bsplic.vercel.app`. Universal Links i Android App Links wymagają jeszcze zewnętrznych plików asocjacyjnych opisanych w raporcie stanu. Publikacja przez EAS/App Store/Google Play nie należy do tego przebiegu.
