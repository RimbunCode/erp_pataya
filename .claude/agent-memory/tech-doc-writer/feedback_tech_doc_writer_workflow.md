---
name: feedback-tech-doc-writer-workflow
description: How this user scopes doc-update tasks — targeted section additions to existing files, not new files, with a mandatory full-draft review step
metadata:
  type: feedback
---

When asked to add a section to project docs, the user gives precise, pre-verified facts to document (exact file paths, exact config behavior, a specific bug narrative) rather than asking me to discover them from scratch. Facts should still be spot-checked against the actual source (paths, config content, example test files) before writing, but the user has already done the investigation — the job is accurate transcription into the existing doc's voice, not open-ended exploration.

**Why:** avoids hallucinated or generalized claims in technical docs; the user explicitly flags this project's docs must be code-verified, not guessed.

**How to apply:**
- Do not create new documentation files unless explicitly requested — add to the named existing file(s) only (confirmed again here: `docs/frontend.md` and `CLAUDE.md`, matching the general `tech-doc-writer` mandate of never creating docs without explicit ask).
- Read the target file's existing structure/style first (heading levels, language — this repo's docs mix Indonesian prose with English code blocks, table-heavy) and match it exactly rather than introducing a new tone.
- For `CLAUDE.md` specifically: keep additions terse and rule-oriented (bullet list of "must follow" points), matching the existing "Struktur Folder `{Domain}/{Feature}`" section style — not a duplicate of the full docs/frontend.md content, just the actionable subset with a link back.
- After writing, the user wants the full draft shown in the final response for review, plus an explicit statement of which section went into which file — not just "done."

Related: [[project_frontend_testing_setup]] for the specific testing-doc content this rule was applied to.
