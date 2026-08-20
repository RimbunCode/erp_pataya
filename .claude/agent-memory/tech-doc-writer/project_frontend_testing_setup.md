---
name: project-frontend-testing-setup
description: Frontend testing (Vitest) was newly set up on dev-rahmad-5 (2026-08) — three test types, naming convention, and a documented fast-check precondition bug
metadata:
  type: project
---

Frontend testing infrastructure was set up on branch `dev-rahmad-5` around 2026-08-19/20. Documented in `docs/frontend.md#testing` (new section) and summarized in root `CLAUDE.md`.

**Why:** the team wants three distinct FE test patterns used deliberately (not interchangeably), and wants the fast-check precondition mistake remembered so it isn't repeated in future property tests.

**How to apply:** when documenting or writing new frontend tests in this repo:
- Tests are co-located with source (no `__tests__` folder).
- `vitest.config.js` uses `test.projects` (Vitest v4 removed `environmentMatchGlobs`) — two projects: `unit` (environment `node`, `*.test.{js,ts}`) and `component` (environment `jsdom`, `*.rtl.test.{jsx,tsx}`, setupFiles `resources/js/test-setup.js`).
- Three test kinds, in priority order: (1) pure-function unit tests — preferred/fastest; (2) React Testing Library component tests suffixed `.rtl.test.jsx` — the recommended default for new UI components with user interaction; (3) source-assertion tests (`readFileSync` + regex `toMatch`) — fragile, avoid for new components, only for genuinely hard-to-render behavior (e.g. GrapesJS canvas internals).
- Naming `.rtl.test.jsx` is load-bearing, not cosmetic — it's what routes the file into the jsdom project. Missing the suffix silently runs the file under `node` and fails with `document is not defined`.
- fast-check property tests: `fc.pre()`/`.filter()` preconditions must match source validation exactly. Real bug found: source used `Boolean(value.trim())`, test precondition used `fc.pre(Boolean(value))` — whitespace-only strings passed the precondition but were rejected by source, and random-seed variance meant the test only failed occasionally.
- CI: `.github/workflows/tests.yml` runs `backend` (PHPUnit) and `frontend` (`npm run test`, both Vitest projects) jobs in parallel, no `continue-on-error` — separate from `.github/workflows/lint.yml` which does auto-fix/auto-commit with `continue-on-error: true`.

See [[feedback_tech_doc_writer_workflow]] for how this doc-update task was scoped (update existing files only, no new doc files, show full draft before considering done).
