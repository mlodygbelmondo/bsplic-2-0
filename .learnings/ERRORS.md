# Errors

Command failures and integration errors.

---

## [ERR-20260425-002] npm-run-lint-existing-issues

**Logged**: 2026-04-25T07:41:00Z
**Priority**: low
**Status**: pending
**Area**: config

### Summary
Repository-wide `npm run lint` currently fails on pre-existing generated/shadcn/config issues, even when linting the touched RouletteWheel files directly succeeds.

### Error
```
npm run lint
eslint .

dev-dist/workbox-5a5d9309.js: missing @typescript-eslint rule definitions and unused eslint-disable warnings
src/components/ui/command.tsx: no-empty-object-type
src/components/ui/textarea.tsx: no-empty-object-type
tailwind.config.ts: no-require-imports
```

### Context
- Command attempted after a focused frontend asset swap in `src/features/casino/components/RouletteWheel.tsx`.
- `npx eslint src/features/casino/components/RouletteWheel.tsx src/features/casino/components/RouletteWheel.test.tsx` exited cleanly.
- The failing files were not part of the task.

### Suggested Fix
Exclude build outputs such as `dev-dist/` from repository lint or fix/update the existing shadcn and Tailwind config lint violations separately.

### Metadata
- Reproducible: yes
- Related Files: dev-dist/workbox-5a5d9309.js, src/components/ui/command.tsx, src/components/ui/textarea.tsx, tailwind.config.ts

---

## [ERR-20260425-001] webapp-testing-helper

**Logged**: 2026-04-25T05:18:00Z
**Priority**: low
**Status**: pending
**Area**: tests

### Summary
The webapp testing helper failed when invoked with `python` because this environment only has `python3`.

### Error
```
/bin/bash: line 1: python: command not found
```

### Context
- Command attempted: `python /home/piotr/.agents/skills/webapp-testing/scripts/with_server.py --help`
- Retried successfully with `python3`.

### Suggested Fix
Use `python3` for bundled Python helper scripts in this workspace.

### Metadata
- Reproducible: yes
- Related Files: none

---
