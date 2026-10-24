import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const fieldTypes = [
  'short_text',
  'long_text',
  'single_choice',
  'multiple_choice',
  'number',
  'email',
  'date',
  'rating',
  'consent',
];

const formSchemaJson = {
  type: 'object',
  additionalProperties: false,
  required: ['schema_version', 'title', 'description', 'default_locale', 'enabled_locales', 'sections'],
  properties: {
    schema_version: { type: 'integer', const: 1 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 1000 },
    default_locale: { type: 'string', pattern: '^[a-z]{2,3}(?:-[A-Z][a-z]{2})?$' },
    enabled_locales: { type: 'array', minItems: 1, maxItems: 5, items: { type: 'string' } },
    sections: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'fields'],
        properties: {
          id: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,63}$' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
          fields: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'type', 'label', 'required'],
              properties: {
                id: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,63}$' },
                type: { type: 'string', enum: fieldTypes },
                label: { type: 'string', minLength: 1, maxLength: 500 },
                help_text: { type: 'string', maxLength: 1000 },
                required: { type: 'boolean' },
                options: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 20,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id', 'label'],
                    properties: {
                      id: { type: 'string', pattern: '^[a-z][a-z0-9_]{1,63}$' },
                      label: { type: 'string', minLength: 1, maxLength: 300 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const responseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['schema', 'explanation', 'validation_findings'],
  properties: {
    schema: formSchemaJson,
    explanation: { type: 'string', maxLength: 2000 },
    validation_findings: { type: 'array', items: { type: 'string', maxLength: 500 }, maxItems: 20 },
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSchema(value: unknown): string[] {
  if (!isRecord(value)) return ['Provider returned no schema object.'];
  const errors: string[] = [];
  if (value['schema_version'] !== 1) errors.push('Unsupported schema version.');
  if (typeof value['title'] !== 'string' || !value['title'].trim()) errors.push('Schema title is required.');
  if (typeof value['default_locale'] !== 'string') errors.push('Default locale is required.');
  if (!Array.isArray(value['enabled_locales']) || value['enabled_locales'].length === 0) {
    errors.push('At least one enabled locale is required.');
  }
  const sections = value['sections'];
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push('At least one section is required.');
    return errors;
  }
  const sectionIds = new Set<string>();
  const fieldIds = new Set<string>();
  for (const section of sections) {
    if (!isRecord(section) || typeof section['id'] !== 'string' || typeof section['title'] !== 'string') {
      errors.push('Every section must have an id and title.');
      continue;
    }
    const sectionId = section['id'];
    if (sectionIds.has(sectionId)) errors.push(`Duplicate section ID: ${sectionId}.`);
    sectionIds.add(sectionId);
    const fields = section['fields'];
    if (!Array.isArray(fields) || fields.length === 0) errors.push(`Section ${sectionId} has no fields.`);
    for (const field of Array.isArray(fields) ? fields : []) {
      if (!isRecord(field) || typeof field['id'] !== 'string' || typeof field['label'] !== 'string' || !fieldTypes.includes(String(field['type']))) {
        errors.push(`Invalid field in section ${sectionId}.`);
        continue;
      }
      const fieldId = field['id'];
      if (fieldIds.has(fieldId)) errors.push(`Duplicate field ID: ${fieldId}.`);
      fieldIds.add(fieldId);
      const fieldType = field['type'];
      const options = field['options'];
      if ((fieldType === 'single_choice' || fieldType === 'multiple_choice') && !Array.isArray(options)) {
        errors.push(`Choice field ${fieldId} must have options.`);
      }
      const optionIds = new Set<string>();
      for (const option of Array.isArray(options) ? options : []) {
        if (!isRecord(option) || typeof option['id'] !== 'string' || typeof option['label'] !== 'string') {
          errors.push(`Invalid option in field ${fieldId}.`);
        } else {
          if (optionIds.has(option['id'])) errors.push(`Duplicate option ID in field ${fieldId}: ${option['id']}.`);
          optionIds.add(option['id']);
        }
      }
    }
  }
  return errors;
}

function extractJson(content: unknown): unknown {
  if (typeof content !== 'string') return content;
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    // Some provider responses add prose or multiple brace blocks around the
    // object. Find balanced JSON objects while respecting quoted braces.
    for (let start = 0; start < trimmed.length; start += 1) {
      if (trimmed[start] !== '{') continue;
      let depth = 0;
      let quoted = false;
      let escaped = false;
      for (let end = start; end < trimmed.length; end += 1) {
        const character = trimmed[end];
        if (quoted) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === '"') quoted = false;
          continue;
        }
        if (character === '"') quoted = true;
        else if (character === '{') depth += 1;
        else if (character === '}') {
          depth -= 1;
          if (depth === 0) {
            try {
              return JSON.parse(trimmed.slice(start, end + 1));
            } catch {
              break;
            }
          }
        }
      }
    }
    throw new Error('No valid JSON object found.');
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  console.log(JSON.stringify({ event: 'auth_check', authenticated: Boolean(user) }));
  if (!user) return jsonResponse({ error: 'Authentication required.' }, 401);

  const apiKey = Deno.env.get('SARVAM_API_KEY');
  console.log(JSON.stringify({ event: 'secret_check', sarvam_configured: Boolean(apiKey) }));
  if (!apiKey) return jsonResponse({ error: 'Sarvam is not configured.' }, 503);

  let input: unknown;
  try { input = await request.json(); } catch { return jsonResponse({ error: 'Invalid JSON body.' }, 400); }
  if (!isRecord(input) || typeof input['prompt'] !== 'string' || input['prompt'].trim().length < 10 || input['prompt'].length > 4000) {
    return jsonResponse({ error: 'Prompt must be between 10 and 4000 characters.' }, 400);
  }
  const locale = typeof input['locale'] === 'string' ? input['locale'] : 'en';
  console.log(JSON.stringify({ event: 'provider_request', provider: 'sarvam', model: 'sarvam-105b', locale, prompt_length: input['prompt'].length }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const sarvamResponse = await fetch('https://api.sarvam.ai/v2/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'api-subscription-key': apiKey },
      body: JSON.stringify({
        model: 'sarvam-105b',
        temperature: 0.2,
        max_tokens: 3000,
        messages: [
          { role: 'system', content: `You create concise, accessible forms. Return only JSON matching the supplied schema. Use locale ${locale}. IDs must be stable snake_case identifiers. Never invent answers or include HTML, JavaScript, SQL, or expressions. Choice fields need stable option IDs.` },
          { role: 'user', content: input['prompt'] },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'generated_form', strict: true, schema: responseJsonSchema } },
      }),
    });
    if (!sarvamResponse.ok) {
      let providerCode: string | undefined;
      let providerRequestId: string | undefined;
      try {
        const errorPayload = await sarvamResponse.clone().json();
        providerCode = typeof errorPayload?.error?.code === 'string' ? errorPayload.error.code : undefined;
        providerRequestId = typeof errorPayload?.error?.request_id === 'string' ? errorPayload.error.request_id : undefined;
      } catch {
        // Keep provider error handling safe when the upstream body is not JSON.
      }
      console.error(JSON.stringify({ event: 'provider_error', status: sarvamResponse.status, code: providerCode, request_id: providerRequestId }));
      return jsonResponse({ error: 'The generation provider returned an error.', provider_status: sarvamResponse.status, provider_code: providerCode, provider_request_id: providerRequestId }, sarvamResponse.status === 429 ? 429 : 502);
    }
    const payload = await sarvamResponse.json();
    const content = payload?.choices?.[0]?.message?.content;
    let result: unknown;
    try { result = extractJson(content); } catch { return jsonResponse({ error: 'Provider returned malformed JSON.' }, 502); }
    // Some structured-output responses return the requested form schema
    // directly instead of preserving the proposal envelope. Normalize that
    // shape without relaxing validation or accepting arbitrary output.
    if (isRecord(result) && result['schema_version'] === 1 && Array.isArray(result['sections'])) {
      result = { schema: result, explanation: '', validation_findings: [] };
    }
    if (!isRecord(result) || !isRecord(result['schema'])) {
      console.error(JSON.stringify({ event: 'invalid_proposal_shape', result_type: typeof result, keys: isRecord(result) ? Object.keys(result).slice(0, 20) : [] }));
      return jsonResponse({ error: 'Provider returned an invalid proposal.' }, 502);
    }
    const validationErrors = validateSchema(result['schema']);
    if (validationErrors.length) {
      console.error(JSON.stringify({ event: 'schema_validation_error', count: validationErrors.length, errors: validationErrors.slice(0, 5) }));
      return jsonResponse({ error: 'Provider returned an invalid form schema.', validation_errors: validationErrors }, 502);
    }
    return jsonResponse({ schema: result['schema'], explanation: result['explanation'] ?? '', validation_findings: result['validation_findings'] ?? [], provider: 'sarvam', model: 'sarvam-105b' });
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError' ? 'Generation timed out.' : 'Generation failed.';
    return jsonResponse({ error: message }, 504);
  } finally {
    clearTimeout(timeout);
  }
});
