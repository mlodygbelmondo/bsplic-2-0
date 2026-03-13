# BetBuddy Polska 2.0

Epiczna arena zakładów społecznościowych: live kupony, rankingi, propozycje od graczy i panel admina do pełnej kontroli rozgrywki.

## Co to jest?

BetBuddy Polska to aplikacja webowa, w której:

- gracze obstawiają aktywne wydarzenia (single / AKO),
- budują passy i odblokowują badge,
- zgłaszają własne propozycje zakładów,
- admin moderuje, publikuje i rozlicza wydarzenia.

To nie jest zwykły CRUD. To feed zakładów + realtime + ekonomia portfela + gameplay loop.

## Najważniejsze funkcje

- **Home feed zakładów** z kategoriami i sortowaniem `Popularne` / `Najnowsze`
- **Coupon Drawer** (desktop + mobile) do budowania kuponu i stawiania zakładów
- **Propozycje zakładów** od użytkowników (workflow akceptacji/rejekcji)
- **Panel admina** do tworzenia, rozliczania i moderacji
- **Rankingi i profil** z passami, bilansem i osiągnięciami
- **Supabase realtime** dla świeżych danych bez ręcznego odświeżania

## Stack

- Vite
- React 18 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth + DB)
- Vitest + Testing Library

## Szybki start

### 1) Wymagania

- Node.js 18+
- npm

### 2) Instalacja

```bash
npm install
```

### 3) Konfiguracja `.env`

Utwórz plik `.env` i dodaj:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

### 4) Uruchomienie dev

```bash
npm run dev
```

Domyślnie aplikacja działa na porcie `8080`.

## Komendy

```bash
npm run dev         # lokalny development
npm run build       # build produkcyjny
npm run build:dev   # build w trybie development
npm run preview     # podgląd buildu
npm run lint        # eslint
npm run test        # vitest (single run)
npm run test:watch  # vitest watch
```

Przykładowy pojedynczy test:

```bash
npm run test -- src/test/example.test.ts
```

## Architektura katalogów

```text
src/
  components/                # komponenty współdzielone
  components/ui/             # prymitywy shadcn/ui
  contexts/                  # AuthContext, CouponContext
  features/
    home/
      api/                   # zapytania/mutacje Supabase
      hooks/                 # logika ekranu home
      layout/                # kompozycja layoutu home
  integrations/supabase/     # client + typy wygenerowane
  pages/                     # routing pages
  types/                     # typy domenowe
```

## Reguły projektu (ważne)

- Zachowuj czysty podział: `UI -> hooks -> api`.
- Nie wrzucaj sekretów do repo.
- Dla home layout: strona mieści się w `h-screen`, a scroll jest tylko tam, gdzie ma być.
- Dla typów `12` i `1x2` liczba opcji jest stała (bez dodawania/usuwania opcji).
- `Popularne` sortuje po `bet_count` malejąco.

Pełne zasady dla agentów i workflow: `AGENTS.md`.

## Jakość i utrzymanie

- Stawiamy na małe, czytelne komponenty.
- Każdy async flow z loadingiem powinien mieć `try/catch/finally`.
- Błędy pokazujemy userowi (toast), nie zamiatamy pod dywan.
- Ograniczamy scope zmian do aktualnego taska.

## Roadmap vibe (next-level)

- więcej formatów zakładów,
- mocniejsze statystyki i analityka gracza,
- testy E2E kluczowych flow,
- dalsze wygładzanie UX mobile.

---

Jeśli właśnie odpalasz projekt po raz pierwszy: skonfiguruj `.env`, zrób `npm install`, odpal `npm run dev` i wchodzisz do gry.
