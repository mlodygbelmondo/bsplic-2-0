# Admin Panel Layout And Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Zamknąć scroll panelu admina wewnątrz komponentu, poprawić mobilny navbar admina oraz rozszerzyć ekran zarządzania o filtry i pełniejsze akcje desktopowe.

**Architecture:** Główna poprawka polega na ograniczeniu wysokości obszaru admina do viewportu i przeniesieniu scrolla do wewnętrznego kontenera treści. Równolegle ekran `ManageBetsTab` dostaje czyste filtrowanie po statusie i typie oraz szerszy layout desktopowy, a `CreateBetTab` przechodzi na układ dwukolumnowy na większych ekranach bez zmiany logiki zapisu.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Vitest, Testing Library.

---

### Task 1: Dodać test filtrowania zakładów

**Files:**
- Create: `src/features/admin/components/ManageBetsTab.test.tsx`
- Modify: `src/features/admin/components/ManageBetsTab.tsx`

**Step 1: Write the failing test**

Napisać test renderujący `ManageBetsTab` z zamockowanym Supabase i sprawdzić, że:
- lista pokazuje wszystkie zakłady po załadowaniu,
- zmiana filtra statusu ogranicza listę do aktywnych lub rozstrzygniętych,
- zmiana filtra typu ogranicza listę do wybranego `bet_type`.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/admin/components/ManageBetsTab.test.tsx`

Expected: FAIL, bo filtry statusu i typu jeszcze nie istnieją.

**Step 3: Write minimal implementation**

Dodać stan filtrów, logikę filtrowania i kontrolki `Select` w `ManageBetsTab.tsx`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/admin/components/ManageBetsTab.test.tsx`

Expected: PASS.

### Task 2: Zamknąć layout admina w viewportcie

**Files:**
- Modify: `src/features/admin/components/AdminLayout.tsx`

**Step 1: Ograniczyć wysokość głównego kontenera**

Zmienić układ tak, aby po `Navbar` panel admina miał wysokość `calc(100dvh - navbarHeight)` i korzystał z `overflow-hidden`.

**Step 2: Włączyć scroll tylko w obszarze treści**

Dodać `overflow-y-auto` do głównego kontenera contentu, tak aby nie przewijała się cała strona.

**Step 3: Osadzić mobilny navbar admina przy dolnej krawędzi**

Zmienić pozycjonowanie z dryfującego `bottom-6` na przyklejone do dołu ekranu z lekkim cieniem i bez marnowania miejsca.

### Task 3: Przebudować `CreateBetTab` pod większe ekrany

**Files:**
- Modify: `src/features/admin/components/CreateBetTab.tsx`

**Step 1: Zmienić ikonę zakładki tworzenia**

W `AdminLayout` użyć ikony zawierającej plus i lepiej komunikującej akcję tworzenia.

**Step 2: Wprowadzić układ 2-kolumnowy**

Na `lg+` ustawić lewą kolumnę z sekcjami `Podstawowe informacje` i `Opcje dodatkowe`, a prawą kolumnę z `Możliwe typy`.

**Step 3: Zachować ergonomię mobile**

Zostawić przycisk submit przyklejony do dołu na mobile, ale bez generowania dodatkowego scrolla całej strony.

### Task 4: Rozszerzyć ekran zarządzania zakładami

**Files:**
- Modify: `src/features/admin/components/ManageBetsTab.tsx`

**Step 1: Dodać białe tło i shadow do wyszukiwarki**

Input `Szukaj zakładów` ma być czytelny na tle panelu.

**Step 2: Dodać dropdowny filtrów**

Dodać filtry po statusie i typie zakładu obok wyszukiwarki.

**Step 3: Poszerzyć layout desktopowy**

Usunąć sztuczne ograniczenie szerokości na desktopie przez integrację z `AdminLayout` oraz pokazać pełne przyciski `Edytuj` i `Ogłoś wynik` zamiast samych ikon.

**Step 4: Poprawić paginację desktopową**

Ustawić `Wstecz` i `Dalej` obok numerów stron bez nachodzenia i overflow.

**Step 5: Poprawić wyrównanie sekcji korekty**

W sekcji `Zakres korekty` ustawić elementy na `items-center` i usunąć rozjazd label/checkbox.

### Task 5: Zweryfikować całość

**Files:**
- Modify: `src/features/admin/components/AdminLayout.tsx`
- Modify: `src/features/admin/components/CreateBetTab.tsx`
- Modify: `src/features/admin/components/ManageBetsTab.tsx`
- Create: `src/features/admin/components/ManageBetsTab.test.tsx`

**Step 1: Run focused tests**

Run: `npm run test -- src/features/admin/components/ManageBetsTab.test.tsx`

**Step 2: Run relevant lint/build checks**

Run: `npx eslint src/features/admin/components/AdminLayout.tsx src/features/admin/components/CreateBetTab.tsx src/features/admin/components/ManageBetsTab.tsx src/features/admin/components/ManageBetsTab.test.tsx`

**Step 3: Report actual outcomes**

Udokumentować, które komendy przeszły, a które blokują istniejące błędy repo.
