# AGENTS.md — AI-First Multilingual Form Builder

Read this first. Details: `docs/SPEC.md` (contract), `docs/MILESTONES.md` (order + acceptance). Spec is authoritative unless the user overrides.

## Product (1 paragraph)
Creator describes needs in natural language → AI drafts an editable form → creator refines by chat or manually → translates → publishes immutable version → reviews responses in chosen language. Respondents get a normal structured form (NOT a chatbot), in their own language; free text is accepted in any language and translated for the creator. Originals are never altered.

## Stack
Angular + TypeScript · Supabase (Postgres, Auth, RLS, Edge Functions) · Sarvam APIs behind an adapter. Excluded: Phoenix/Elixir, Jev.

## Rules
1. Inspect repo first (versions, package manager, conventions, lint, tests). Never assume blank repo.
2. Small, reversible changes; no rewrites; keep existing conventions (explain conflicts, propose smallest fix).
3. One vertical slice at a time, per `docs/MILESTONES.md`.
4. No new dependency if an equivalent exists.
5. Secrets (API keys, service-role) never in frontend, commits, logs.
6. Model output = untrusted: parse → validate vs schema → authorize → show diff → persist only on creator acceptance.
7. Never execute model-generated HTML/JS/SQL/expressions. Allowlists only.
8. Don't invent requirements. Use defaults in SPEC §Defaults; ask only if blocked or a security/legal/schema/migration trade-off arises.
9. Add tests with every feature; run tests, typecheck, lint, build; report real results.
10. Never claim done unless implemented AND verified. Label: implemented / partial / mocked / not implemented.
11. UI is form-first and accessible (semantic HTML, keyboard, visible focus, not color alone).

## Invariants (never break)
- Original free text is immutable; translations stored separately and linked to source text + target locale.
- Choice answers stored as option IDs, never labels. IDs are stable, never regenerated/translated.
- Published versions immutable; edits create new draft. Every response references its exact version.
- AI never fills in answers or silently alters data; low-confidence translations (very low only) get a small hint.
- Translation failure never blocks submission.
- AI edits modify existing form via typed ops; never regenerate whole form for a local edit.

## Completion report (only these 5)
Implemented · Files changed · Verification (commands + results) · Known gaps · Next step.
