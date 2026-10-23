# MILESTONES
Do one at a time. After each, send completion report (AGENTS.md format) with exact files + tests run. Don't start the next without passing acceptance.

| # | Work | Acceptance |
|---|------|-----------|
| 0 | Repo audit: tree, scripts, Angular/Supabase versions, env conventions, tests, UI. Report architecture + gaps. No destructive changes. | Report delivered |
| 1 | Schema contract: typed defs, runtime validator, fixtures, tests, supported types, declarative conditions | Invalid schemas can't reach renderer or persistence |
| 2 | Renderer + manual editor: reusable accessible field components, preview, add/edit/delete/reorder, client/server validation split | Sample schema renders; accessible interactions work |
| 3 | Supabase: migrations, auth, RLS, draft save, versioning, publish; cross-tenant tests | Published versions immutable; responses version-linked |
| 4 | Public form load, locale select, submission validation, response review, CSV export | E2E response flow passes; originals + option IDs preserved |
| 5 | Sarvam adapter + `generate_form`: verify current docs/models/locales/secrets first; schema-constrained proposals; reviewable draft | Malformed provider output can't be saved/published |
| 6 | `propose_form_edit` ops, diff review, undo, `translate_form`, translation status, `translate_response`, original/translated view | Translations don't change semantics; local edits don't touch unrelated fields |
| 7 | Hardening: rate limits, quotas, observability, failure handling, a11y checks, security tests, eval fixtures; async queue only if needed | All security + reliability tests pass |
