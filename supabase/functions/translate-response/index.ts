import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);
  const apiKey = Deno.env.get('SARVAM_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'Sarvam is not configured.' }, 503);
  let input: unknown;
  try { input = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON body.' }, 400); }
  if (!isRecord(input) || typeof input.text !== 'string' || !input.text.trim() || typeof input.source_locale !== 'string' || typeof input.target_locale !== 'string') {
    return jsonResponse({ error: 'Text, source locale, and target locale are required.' }, 400);
  }
  if (input.text.length > 10_000) return jsonResponse({ error: 'Response text is too long.' }, 400);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch('https://api.sarvam.ai/v2/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        model: 'sarvam-105b', temperature: 0.1, max_tokens: 1500,
        messages: [
          { role: 'system', content: `Translate the response faithfully from ${input.source_locale} to ${input.target_locale}. Return only JSON with a text property. Preserve names, numbers, URLs, and meaning. Do not add commentary.` },
          { role: 'user', content: input.text },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return jsonResponse({ error: 'The translation provider returned an error.' }, response.status === 429 ? 429 : 502);
    const payload = await response.json();
    const parsed = parseJson(payload?.choices?.[0]?.message?.content);
    if (!isRecord(parsed) || typeof parsed.text !== 'string' || !parsed.text.trim()) return jsonResponse({ error: 'Provider returned an invalid translation.' }, 502);
    return jsonResponse({ text: parsed.text, provider: 'sarvam', model: 'sarvam-105b', status: 'complete' });
  } catch (error) {
    return jsonResponse({ error: error instanceof DOMException && error.name === 'AbortError' ? 'Translation timed out.' : 'Translation failed.' }, 504);
  } finally { clearTimeout(timeout); }
});

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch { const start = text.indexOf('{'); const end = text.lastIndexOf('}'); return start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : null; }
}
