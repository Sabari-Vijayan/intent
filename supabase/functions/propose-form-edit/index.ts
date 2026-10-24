import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const operationTypes = [
  'add_section', 'update_section', 'remove_section', 'add_field', 'update_field',
  'remove_field', 'reorder_fields', 'update_validation', 'update_form_metadata',
];

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractJson(content: unknown): unknown {
  if (typeof content !== 'string') return content;
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(text); } catch { /* find a JSON object inside provider prose */ }
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0; let quoted = false; let escaped = false;
    for (let end = start; end < text.length; end += 1) {
      const char = text[end];
      if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue; }
      if (char === '"') quoted = true;
      else if (char === '{') depth += 1;
      else if (char === '}' && --depth === 0) {
        try { return JSON.parse(text.slice(start, end + 1)); } catch { break; }
      }
    }
  }
  throw new Error('No valid JSON object found.');
}

function validateProposal(value: unknown): string[] {
  if (!isRecord(value)) return ['Proposal must be an object.'];
  if (!Array.isArray(value.ops) || value.ops.length > 30) return ['Proposal must contain at most 30 operations.'];
  const errors: string[] = [];
  value.ops.forEach((op, index) => {
    if (!isRecord(op) || typeof op.op !== 'string' || !operationTypes.includes(op.op)) {
      errors.push(`Invalid operation at index ${index}.`); return;
    }
    if (['update_field', 'remove_field', 'update_validation'].includes(op.op) && typeof op.field_id !== 'string') errors.push(`Operation ${index} needs a field_id.`);
    if (['update_section', 'remove_section', 'reorder_fields'].includes(op.op) && typeof op.section_id !== 'string') errors.push(`Operation ${index} needs a section_id.`);
    if (op.op === 'reorder_fields' && (!Array.isArray(op.field_ids) || op.field_ids.some((id) => typeof id !== 'string'))) errors.push(`Operation ${index} has invalid field_ids.`);
  });
  return errors;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);
  const apiKey = Deno.env.get('SARVAM_API_KEY');
  if (!apiKey) return jsonResponse({ error: 'Sarvam is not configured.' }, 503);

  let input: unknown;
  try { input = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON body.' }, 400); }
  if (!isRecord(input) || !isRecord(input.schema) || typeof input.instruction !== 'string' || input.instruction.trim().length < 3 || input.instruction.length > 4000) {
    return jsonResponse({ error: 'A schema and instruction between 3 and 4000 characters are required.' }, 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('https://api.sarvam.ai/v2/chat/completions', {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        model: 'sarvam-105b', temperature: 0.1, max_tokens: 3000,
        messages: [
          { role: 'system', content: 'Edit the supplied form using only typed operations. Never change IDs, invent answers, execute code, or return a full schema. Return JSON with ops, explanation, and diff_summary. Use existing IDs for updates/removals/reorders.' },
          { role: 'user', content: JSON.stringify({ schema: input.schema, instruction: input.instruction }) },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'form_edit', strict: false, schema: {
          type: 'object', additionalProperties: false, required: ['ops', 'explanation', 'diff_summary'],
          properties: {
            ops: { type: 'array', maxItems: 30, items: { type: 'object', additionalProperties: true, required: ['op'], properties: { op: { type: 'string', enum: operationTypes } } } },
            explanation: { type: 'string', maxLength: 2000 }, diff_summary: { type: 'string', maxLength: 2000 },
          },
        } } },
      }),
    });
    if (!response.ok) return jsonResponse({ error: 'The generation provider returned an error.' }, response.status === 429 ? 429 : 502);
    const payload = await response.json();
    const result = extractJson(payload?.choices?.[0]?.message?.content);
    const errors = validateProposal(result);
    if (errors.length) return jsonResponse({ error: 'Provider returned invalid edit operations.', validation_errors: errors }, 502);
    return jsonResponse({ ...(result as Record<string, unknown>), provider: 'sarvam', model: 'sarvam-105b' });
  } catch (error) {
    return jsonResponse({ error: error instanceof DOMException && error.name === 'AbortError' ? 'Edit proposal timed out.' : 'Edit proposal failed.' }, 504);
  } finally { clearTimeout(timeout); }
});
