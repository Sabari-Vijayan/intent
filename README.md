# Intent

Intent is a multilingual form builder for teams that need to collect structured
responses without losing the language or meaning of the person answering.

Creators can describe a form, edit the resulting schema, translate it, publish
an immutable version, and review responses in the creator's preferred language.
Respondents always receive a normal form — not a chatbot.

## What is implemented

- Email/password creator authentication.
- Draft form creation, editing, preview, and publishing.
- Immutable published form versions.
- Public forms with locale selection and client-side validation.
- Structured choice answers stored by stable option ID.
- Creator response review with pagination and CSV export.
- Response review dashboard with submission trends, language mix, question
  insights, responsive answer cards, and saved translation controls.
- Supabase Edge Functions for Sarvam-powered form generation, form editing,
  form translation, and requested free-text response translation.
- Hardened AI form generation: validates proposals, handles provider response
  shape variations, and supports larger drafts without persisting untrusted output.
- Reviewable AI proposals: generated forms and edits require creator acceptance.

The current implementation is a working prototype. See [checklist.md](checklist.md)
for the milestone-by-milestone status and known gaps.

## Demo

[Watch the demo video](https://drive.google.com/drive/folders/17gWddGnAkxR2Q2ZIhcnUacA50gUkJR20?usp=drive_link)

## Stack

- Angular 18 and TypeScript
- Supabase Auth, Postgres, Row Level Security, and Edge Functions
- Sarvam APIs, accessed only from Edge Functions
- npm for package management

## Repository guide

| Path | Purpose |
| --- | --- |
| `src/app/features` | Auth, form editor, public form, and response views |
| `src/app/shared` | Shared layout and schema-driven form renderer |
| `src/app/core` | Supabase provider and data access service |
| `src/app/types` | Form schema types, validation, fixtures, and edit operations |
| `supabase.sql` | Database schema, triggers, and RLS policies |
| `supabase/functions` | Server-side Sarvam adapters |
| `SPEC.md` | Product contract and invariants |
| `MILESTONES.md` | Delivery order and acceptance criteria |
| `checklist.md` | Current implementation status |

## Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project
- Supabase CLI for database and Edge Function deployment
- Chromium/Brave only if running the browser test command locally

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create or update `src/environments/environment.ts` with the public Supabase
   URL and anon/publishable key. This file is suitable for local development;
   never put a service-role key or Sarvam key in it.

   ```ts
   export const environment = {
     production: false,
     supabase: {
       url: 'https://YOUR_PROJECT.supabase.co',
       anonKey: 'YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY',
     },
   };
   ```

3. Apply `supabase.sql` to the project from the Supabase SQL editor or with
   the Supabase CLI. Confirm that Auth email/password sign-in is enabled.

4. Start the Angular development server:

   ```bash
   npm start
   ```

   Open `http://localhost:4200`.

## Environment variables

Production builds can generate the environment file immediately before Angular
compiles. Set both variables in the build environment:

```bash
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

The public anon/publishable key is expected in the browser and is protected by
Supabase RLS. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `SARVAM_API_KEY` to
the frontend, commits, browser requests, or logs.

## Sarvam Edge Functions

Set the provider key as a Supabase secret and deploy the functions server-side:

```bash
npx supabase secrets set SARVAM_API_KEY='<your Sarvam key>' --project-ref YOUR_PROJECT_REF
npx supabase functions deploy generate-form --project-ref YOUR_PROJECT_REF
npx supabase functions deploy propose-form-edit --project-ref YOUR_PROJECT_REF
npx supabase functions deploy translate-form --project-ref YOUR_PROJECT_REF
npx supabase functions deploy translate-response --project-ref YOUR_PROJECT_REF
```

For local function development, keep the env file untracked:

```bash
supabase start
supabase functions serve generate-form --env-file supabase/functions/.env
```

See [`supabase/functions/README.md`](supabase/functions/README.md) for the
function-specific setup.

## Useful commands

```bash
npm run typecheck                 # TypeScript validation
npm run build                     # Production Angular build
npm test                          # Karma test runner
npm run lint                      # Currently blocked by the old TSLint builder
npm run format:check              # Prettier check
npx supabase db lint --linked     # Check the linked database schema
```

For a non-interactive browser test run when Chrome/Brave is installed:

```bash
CHROME_BIN=/usr/bin/brave npm test -- --watch=false --browsers=ChromeHeadless
```

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Creator | List forms |
| `/auth` | Public | Sign in or create an account |
| `/forms/new` | Creator | Create a draft form |
| `/forms/:id` | Creator | Edit and publish a form |
| `/forms/:id/responses` | Creator | Review responses and export CSV |
| `/public/:slug` | Public | Answer a published form |

## Data and safety rules

- Published versions are immutable; edits create a new draft/version.
- Responses reference the exact form version they were submitted against.
- Original free text is retained; translations are stored separately.
- Choice responses store option IDs, not translated labels.
- AI output is parsed, schema-validated, and shown for creator review before
  persistence.
- Provider credentials remain server-side in Supabase secrets.
- CSV export guards against spreadsheet formula injection.

## Known limitations

The following are intentionally not presented as complete: server-side semantic
answer validation, transactional response insertion, formal cross-workspace RLS
integration tests, quotas/rate limits, full accessibility testing, persistent
AI revision history, stale translation tracking, and the current lint builder
configuration. Track these in [checklist.md](checklist.md).

## Product contract

Read [SPEC.md](SPEC.md) before changing schema, response, translation, AI, or
publishing behavior. It is the source of truth for invariants and defaults.
