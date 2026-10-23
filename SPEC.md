# SPEC

## 1. Scope
**MVP:** NL draft generation; manual create/edit/delete/reorder; AI edits with diff + undo/revisions; types: short_text, long_text, single_choice, multiple_choice, number, email, date, rating, consent; required/length/range validation; sections; simple conditional visibility; shared canonical schema; locale selector; stable IDs; creator auth; RLS workspace isolation; immutable versions; response list + CSV export; quotas, errors, logging, tests.
**Out:** voice, workflow engines, realtime collab, integrations, payments, file uploads, AI summaries, auto-publish, Phoenix, Jev.

## 2. Architecture
- Frontend (Angular, reactive forms, reusable accessible field components) calls app endpoints for privileged ops; no provider calls from browser.
- Edge Functions hold secrets/privileged logic. Sarvam only inside adapter; verify current endpoint/model/locales/limits in official docs before coding (docs.sarvam.ai).
- DB migrations are source of truth. JSONB for validated schema + translation maps; relational for metadata.
- Authz: RLS + server-side recheck on every op.
- Typed request/response validators (use existing lib, else maintained one).
- Transactions for response+answers; idempotency keys for submissions/retryable jobs.
- Record model/provider/template version for AI ops; don't log response content.

## 3. Canonical schema
Required: `schema_version`; stable IDs for form/section/field/option (never translated); field type from allowlist; labels/help = content only; conditions = declarative allowlisted operators; typed property validation; reject unknown props; max limits (fields, label length, options, free-text); explicit tested migrations.
```json
{"schema_version":1,"title":"…","description":"…","default_locale":"en","enabled_locales":["en","ml"],
 "sections":[{"id":"sec_x","title":"…","fields":[
  {"id":"fld_a","type":"single_choice","label":"…","required":true,
   "options":[{"id":"opt_1","label":"…"}]},
  {"id":"fld_b","type":"long_text","label":"…","required":false,"validation":{"max_length":2000}}]}]}
```
Shape only; implement formal schema + runtime validator first.

## 4. AI operations (provider-independent)
- `generate_form`(prompt, locale, ctx?) → proposed schema + explanation + validation findings. Never persists/publishes.
- `propose_form_edit`(draft, instruction, selection?) → typed ops on stable IDs + explanation + diff. Ops: add/update/remove_section, add/update/remove_field, reorder_fields, update_validation, update_form_metadata. Confirm ambiguous/destructive; keep prior revision for undo.
- `translate_form`(version, src, tgt) → strings mapped to existing IDs. Must not change IDs/types/required/validation/options/logic; validate completeness; keep placeholders; flag low-confidence/missing.
- `translate_response`(answer, src?, tgt) → text + metadata. Original immutable; stored separately; failure non-blocking; never claim exactness.

**Pipeline:** authn/authz → size limits/quotas/rate limits → versioned prompt from validated input → call with timeout + bounded retries (transient only, backoff+jitter) → parse → schema + semantic validation → reject invalid (never coerce into publishable) → return reviewable proposal → persist only on acceptance → record status/model/template/duration/error category.

## 5. Data model
workspaces(id, owner_id, name) · workspace_members(workspace_id, user_id, role; optional) · forms(id, workspace_id, slug, status) · form_versions(id, form_id, version_number, schema_json, creator, published_at) · form_translations(form_version_id, locale, strings, status, provider/model) · responses(id, form_id, form_version_id, submitted_at, respondent_locale, status, idempotency_ref) · response_answers(response_id, field_id, value_json, original_text, original_locale) · answer_translations(answer_id, target_locale, text, provider/model, status) · ai_jobs(only if async needed) · audit_events(actor, workspace, action, resource, ts, limited meta). All with timestamps.
**DB-enforced where feasible:** FKs/uniques/checks; tenant records tied to workspace; answer field_id exists in version; choice option IDs belong to field; no in-place mutation of published versions; no overwrite of original text.

## 6. Security/privacy
RLS enabled + tested on all user tables; deny cross-workspace by default; public endpoints only fetch published form + submit; validate all inputs (body, params, query, schema JSON, export filters); rate limit generation/translation/submission/export; prompts/labels/responses are untrusted data; send response content to AI only when needed + disclosed; HTTPS + managed encryption at rest (extra protection for sensitive fields); redact secrets/PII in logs; CSV formula-injection mitigation; CAPTCHA only if warranted; retention/deletion/backup/incident policies decided before public launch.

## 7. Localization
Locale registry/config (no scattered strings). Locale "supported" only after evaluation + manual review. Test long labels, Unicode, mixed language, dates/numbers, validation messages, mobile. Creator-reviewable translations; mark stale when source changes (changes apply to all languages, flag re-translation). Store respondent locale per response. Exports distinguish original vs translated. Translation async when needed; never delays acceptance. Hint only on very low-confidence translations; original one click away.

## 8. API (logical; follow repo router conventions)
POST /v1/forms · POST /v1/forms/{id}/ai-draft · POST …/ai-edits · PATCH …/draft (revision precondition) · POST …/translations · POST …/publish · GET /v1/public/forms/{slug}?locale= · POST /v1/public/forms/{slug}/responses · GET /v1/forms/{id}/responses (paginated) · POST …/exports · GET /v1/jobs/{id} (if jobs).
Typed contracts, consistent error codes, optimistic concurrency, idempotency on submit/jobs, no raw DB rows as public API, no secrets/internal prompts returned.

## 9. Frontend
**Creator:** form list/create; schema-driven editor; preview via same renderer; AI instruction input + diff review (accept/adjust/undo); revision history; locale + translation status; publish validation/confirm; responses view (original/translated toggle, filter, CSV).
**Respondent:** public route + locale selector; accessible responsive controls; client + server validation; loading/success/retry/failure states; duplicate-submit prevention; no internal IDs/provider metadata shown; no chatbot.
Handle loading, empty, error, partial-translation states.

## 10. Reliability/cost
Timeouts, bounded retries (not on authz/invalid), idempotent handlers, job states (queued/running/succeeded/failed/cancelled), paginate everything, per-user/workspace quotas, track latency/error rate/rate limits/cost/submission success. Add worker/queue only when sync limits are exceeded.

## 11. Defaults (until user decides)
Launch languages: ~5, not finalized, keep configurable · anonymous public submissions allowed · no uploads · no collaboration (leave room in model) · translation optional/async · creator confirms publish · hosting/budget unspecified (assume no prod target) · retention policy pending · Sarvam model verified at implementation time.
**Stop and ask** before irreversible choices affecting security, legal, schema design, or data migration.

## 12. Test acceptance
- **Schema/editor:** valid pass, malformed/unsupported types fail; IDs stable under translation; manual ops correct; invalid conditions rejected; AI edits touch only intended fields; undo restores.
- **AI:** malformed output rejected; timeouts/rate limits → recoverable states; no key in bundles/logs; no publish/commit without validation + acceptance; metadata recorded.
- **Multilingual:** every enabled locale complete; IDs/semantics unchanged; originals unchanged; translation failure doesn't block submit; original accessible.
- **Data/security:** responses link correct immutable version; duplicates handled; cross-workspace denied; public can't reach creator ops; CSV needs authz + injection-safe.
- **Product:** generate→edit→AI-refine→translate→preview→publish; respondent picks locale, submits; creator reviews original/translated, exports CSV; critical flows have loading/empty/failure/retry; typecheck, lint, unit/integration, build pass.
