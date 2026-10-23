# Intent — Project Checklist

Last updated: 2026-10-23

## Overall status

- [x] Angular application scaffold runs successfully.
- [x] Hosted Supabase project connected.
- [x] Creator authentication works.
- [x] Draft form creation and persistence works.
- [x] Form publishing works after applying the version-update RLS policy.
- [x] Public published-form submission works.
- [x] Creator response review and CSV export work.
- [ ] AI generation and AI editing are not implemented.
- [ ] Sarvam translation integration is not implemented.
- [ ] Final UI polish and complete accessibility pass remain.

## Milestone status

### Milestone 0 — Repository audit

- [x] Read `SPEC.md`, `MILESTONES.md`, and `AGENTS.md`.
- [x] Audited Angular/Supabase versions, scripts, source tree, and tests.
- [x] Documented initial architecture and gaps.

### Milestone 1 — Schema contract

- [x] Typed canonical schema definitions.
- [x] Runtime schema validator.
- [x] Supported field-type allowlist.
- [x] Stable ID validation and duplicate detection.
- [x] Locale validation.
- [x] Validation-rule validation.
- [x] Declarative condition validation.
- [x] Unknown-property rejection.
- [x] Schema size limits.
- [x] Valid and invalid fixtures/tests.

Files:

- `src/app/types/schema.ts`
- `src/app/types/schema.validator.ts`
- `src/app/types/schema.fixtures.ts`
- `src/app/types/schema.validator.spec.ts`

### Milestone 2 — Renderer and manual editor

- [x] Schema-driven renderer.
- [x] Supported controls: text, long text, choice, number, email, date, rating, consent.
- [x] Required-field client validation.
- [x] Conditional field visibility.
- [x] Accessible labels, fieldsets, radio groups, and error messages.
- [x] Edit form title and description.
- [x] Add/remove sections.
- [x] Add/remove fields.
- [x] Reorder fields.
- [x] Live preview and respondent preview.

Files:

- `src/app/shared/forms/schema-form-renderer/schema-form-renderer.component.ts`
- `src/app/features/forms/form-editor/form-editor.component.ts`

### Milestone 3 — Supabase, auth, draft, versioning, publishing

- [x] Supabase SQL schema created and executed in the hosted project.
- [x] Workspace and workspace-member tables.
- [x] Forms and form-version tables.
- [x] Response and answer tables.
- [x] Translation and audit-event tables.
- [x] Workspace RLS policies.
- [x] Creator/editor RLS policies.
- [x] Public published-form access policies.
- [x] Immutable published-version trigger.
- [x] Automatic workspace creation for new users.
- [x] Email/password sign-up and sign-in.
- [x] Load forms from Supabase.
- [x] Create and save draft forms.
- [x] Load an existing form version.
- [x] Publish immutable form versions.
- [ ] Sign-out UI.
- [ ] Auth route guard and creator-route protection.
- [ ] Server-side transactional draft/publish operations.
- [ ] Formal cross-workspace/RLS integration tests.

Files:

- `supabase.sql`
- `src/app/core/supabase/supabase.provider.ts`
- `src/app/core/supabase/supabase-data.service.ts`
- `src/app/features/auth/auth.component.ts`
- `src/environments/environment.ts`

### Milestone 4 — Public form and response flow

- [x] Load published forms by slug.
- [x] Public locale selector for enabled locales.
- [x] Render published schema for respondents.
- [x] Client-side required validation.
- [x] Public response insertion.
- [x] Preserve choice option IDs in stored answers.
- [x] Duplicate-submit prevention while submitting.
- [x] Success, loading, and error states.
- [x] Creator response list.
- [x] Pagination.
- [x] Display question labels and choice labels.
- [x] Injection-safe CSV export.
- [ ] Server-side answer/schema semantic validation.
- [ ] Transactional response + answer insertion.
- [ ] Original/translated answer toggle.
- [ ] CSV export with translated/original columns.

Files:

- `src/app/features/public/public-form/public-form.component.ts`
- `src/app/features/responses/response-list/response-list.component.ts`

### Milestone 5 — Sarvam adapter and `generate_form`

- [ ] Verify current Sarvam API endpoint, model, locales, and limits.
- [ ] Create secure Supabase Edge Function adapter.
- [ ] Store Sarvam credentials as Supabase secrets.
- [ ] Add `generate_form` endpoint.
- [ ] Parse and validate provider output.
- [ ] Add quota, timeout, retry, and error handling.
- [ ] Add reviewable generated-form proposal.
- [ ] Ensure AI output cannot publish without creator acceptance.
- [ ] Add provider/model/template metadata logging without response content.

### Milestone 6 — AI edits and translations

- [ ] Implement typed `propose_form_edit` operations.
- [ ] Implement diff review and acceptance.
- [ ] Implement undo/revision history.
- [ ] Implement `translate_form`.
- [ ] Preserve IDs, types, required flags, validation, options, and conditions.
- [ ] Add translation completeness/status UI.
- [ ] Mark translations stale after source edits.
- [ ] Implement `translate_response`.
- [ ] Preserve immutable original response text.
- [ ] Add original/translated response toggle.
- [ ] Ensure translation failure never blocks submission.

### Milestone 7 — Hardening

- [ ] Rate limits and workspace/user quotas.
- [ ] Audit and operational logging.
- [ ] PII/secret redaction checks.
- [ ] Full RLS and authorization tests.
- [ ] Idempotency and retry tests.
- [ ] Translation failure tests.
- [ ] CSV formula-injection tests.
- [ ] Accessibility checks with keyboard and screen-reader scenarios.
- [ ] Mobile and long-Unicode-label checks.
- [ ] Decide whether an async queue is needed.
- [ ] Fix the existing `npm run lint` configuration.

## Current routes

- `/` — authenticated creator form list
- `/auth` — sign-in/sign-up
- `/forms/new` — create a draft form
- `/forms/:id` — edit an existing form
- `/forms/:id/responses` — review responses and export CSV
- `/public/:slug` — public published form

## Verification commands

```bash
npm run typecheck
npm run build
CHROME_BIN=/usr/bin/brave npm test -- --watch=false --browsers=ChromeHeadless
```

Current result:

- Typecheck: passing
- Build: passing
- Tests: 5 passing
- Lint: blocked by the existing outdated TSLint builder in `angular.json`

## Next session — UI focus

- [ ] Improve creator navigation and authenticated header state.
- [ ] Add sign-out control.
- [ ] Add clearer draft/published status and version information.
- [ ] Improve form editor layout and empty states.
- [ ] Add field option editing for choice fields.
- [ ] Improve response review layout and filters.
- [ ] Add mobile and keyboard-accessibility polish.
- [ ] Add visible UI states for loading, errors, save success, and publish confirmation.
