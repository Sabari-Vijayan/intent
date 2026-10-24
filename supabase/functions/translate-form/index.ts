import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keysForSchema(schema: Record<string, unknown>): string[] {
  const keys = ['form.title'];
  if (schema.description) keys.push('form.description');
  for (const section of Array.isArray(schema.sections) ? schema.sections : []) {
    if (!isRecord(section) || typeof section.id !== 'string') continue;
    keys.push(`section.${section.id}.title`);
    if (section.description) keys.push(`section.${section.id}.description`);
    for (const field of Array.isArray(section.fields) ? section.fields : []) {
      if (!isRecord(field) || typeof field.id !== 'string') continue;
      keys.push(`field.${field.id}.label`);
      if (field.help_text) keys.push(`field.${field.id}.help_text`);
      for (const option of Array.isArray(field.options) ? field.options : []) {
        if (isRecord(option) && typeof option.id === 'string') keys.push(`option.${field.id}.${option.id}.label`);
      }
    }
  }
  return keys;
}

function extractJson(content: unknown): unknown {
  if (typeof content !== 'string') return content;
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch { /* provider may wrap JSON in prose */ }
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error('No valid JSON object found.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await supabase.auth.getUser();
  console.log(JSON.stringify({ event: 'auth_check', authenticated: Boolean(user) }));
  if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);
  const apiKey = Deno.env.get('SARVAM_API_KEY');
  console.log(JSON.stringify({ event: 'secret_check', sarvam_configured: Boolean(apiKey) }));
  if (!apiKey) return jsonResponse({ error: 'Sarvam is not configured.' }, 503);
  let input: unknown;
  try { input = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON body.' }, 400); }
  if (!isRecord(input) || !isRecord(input.schema) || typeof input.source_locale !== 'string' || typeof input.target_locale !== 'string' || input.source_locale === input.target_locale) {
    return jsonResponse({ error: 'Schema, source locale, and a different target locale are required.' }, 400);
  }
  const keys = keysForSchema(input.schema);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('https://api.sarvam.ai/v2/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        model: 'sarvam-105b', temperature: 0.1, max_tokens: 4000,
        messages: [
          { role: 'system', content: `Translate only the supplied form strings from ${input.source_locale} to ${input.target_locale}. Return JSON with exactly these keys under strings: ${JSON.stringify(keys)}. Do not translate IDs, field types, option IDs, validation, conditions, or metadata. Preserve placeholders and meaning. Also return completeness (0 to 1) and low_confidence_keys.` },
          { role: 'user', content: JSON.stringify({ strings: Object.fromEntries(keys.map((key) => [key, sourceString(input.schema!, key)])) }) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ event: 'provider_error', status: response.status }));
      return jsonResponse({ error: 'The translation provider returned an error.', provider_status: response.status }, response.status === 429 ? 429 : 502);
    }
    const payload = await response.json();
    const result = extractJson(payload?.choices?.[0]?.message?.content);
    if (!isRecord(result) || !isRecord(result.strings)) {
      console.error(JSON.stringify({ event: 'invalid_translation_shape' }));
      return jsonResponse({ error: 'Provider returned an invalid translation.' }, 502);
    }
    const missing = keys.filter((key) => typeof result.strings![key] !== 'string' || !String(result.strings![key]).trim());
    const unknown = Object.keys(result.strings).filter((key) => !keys.includes(key));
    if (missing.length || unknown.length) {
      console.error(JSON.stringify({ event: 'translation_key_validation_error', missing_keys: missing, unknown_keys: unknown }));
      if (unknown.length) return jsonResponse({ error: 'Provider returned unknown translation keys.', unknown_keys: unknown }, 502);
      const retry = await translateMissingKeys(apiKey, input.schema, input.source_locale, input.target_locale, missing, controller.signal);
      const mergedStrings = { ...result.strings, ...retry };
      const remaining = keys.filter((key) => typeof mergedStrings[key] !== 'string' || !String(mergedStrings[key]).trim());
      if (remaining.length === 0) {
        return jsonResponse({ strings: mergedStrings, completeness: 1, low_confidence_keys: [], missing_keys: [], provider: 'sarvam', model: 'sarvam-105b' });
      }
      return jsonResponse({
        strings: mergedStrings,
        completeness: keys.length ? (keys.length - remaining.length) / keys.length : 1,
        low_confidence_keys: remaining,
        missing_keys: remaining,
        provider: 'sarvam',
        model: 'sarvam-105b',
      });
    }
    return jsonResponse({ strings: result.strings, completeness: 1, low_confidence_keys: Array.isArray(result.low_confidence_keys) ? result.low_confidence_keys : [], provider: 'sarvam', model: 'sarvam-105b' });
  } catch (error) {
    return jsonResponse({ error: error instanceof DOMException && error.name === 'AbortError' ? 'Translation timed out.' : 'Translation failed.' }, 504);
  } finally { clearTimeout(timeout); }
});

function sourceString(schema: Record<string, unknown>, key: string): string {
  const [scope, id, property] = key.split('.');
  if (scope === 'form') return String(schema[property] ?? '');
  const sections = Array.isArray(schema.sections) ? schema.sections : [];
  for (const section of sections) {
    if (!isRecord(section)) continue;
    if (scope === 'section' && section.id === id) return String(section[property] ?? '');
    for (const field of Array.isArray(section.fields) ? section.fields : []) {
      if (!isRecord(field)) continue;
      if (scope === 'field' && field.id === id) return String(field[property] ?? '');
      if (scope === 'option' && field.id === id) {
        const option = (Array.isArray(field.options) ? field.options : []).find((item) => isRecord(item) && item.id === property);
        return isRecord(option) ? String(option.label ?? '') : '';
      }
    }
  }
  return '';
}

async function translateMissingKeys(
  apiKey: string,
  schema: Record<string, unknown>,
  sourceLocale: string,
  targetLocale: string,
  keys: string[],
  signal: AbortSignal,
): Promise<Record<string, string>> {
  if (!keys.length) return {};
  try {
    const response = await fetch('https://api.sarvam.ai/v2/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        model: 'sarvam-105b', temperature: 0.1, max_tokens: 1500,
        messages: [
          { role: 'system', content: `Translate every supplied string from ${sourceLocale} to ${targetLocale}. Return a JSON object with a strings property containing exactly these keys: ${JSON.stringify(keys)}. Do not omit any key. Do not add keys.` },
          { role: 'user', content: JSON.stringify({ strings: Object.fromEntries(keys.map((key) => [key, sourceString(schema, key)])) }) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return {};
    const payload = await response.json();
    const parsed = extractJson(payload?.choices?.[0]?.message?.content);
    if (!isRecord(parsed) || !isRecord(parsed.strings)) return {};
    return Object.fromEntries(keys.filter((key) => typeof parsed.strings![key] === 'string' && String(parsed.strings![key]).trim()).map((key) => [key, String(parsed.strings![key])]));
  } catch {
    return {};
  }
}
