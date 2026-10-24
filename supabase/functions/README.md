# Supabase Edge Functions

## Configure Sarvam

Keep the provider key in Supabase secrets only. Do not add it to Angular environment files,
source control, browser requests, or logs.

```bash
supabase secrets set SARVAM_API_KEY='<your Sarvam key>'
supabase functions deploy generate-form
supabase functions deploy propose-form-edit
supabase functions deploy translate-form
supabase functions deploy translate-response
```

The function expects the caller's Supabase access token and calls Sarvam server-side using
`POST https://api.sarvam.ai/v2/chat/completions` with model `sarvam-105b`.

## Local development

```bash
supabase start
supabase functions serve generate-form --env-file supabase/functions/.env
```

The local env file must remain untracked and contain `SARVAM_API_KEY`. Never commit it.
