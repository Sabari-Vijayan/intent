import { FormSchema } from './schema';

export function translationKeys(schema: FormSchema): string[] {
  const keys = ['form.title'];
  if (schema.description) keys.push('form.description');
  for (const section of schema.sections) {
    keys.push(`section.${section.id}.title`);
    if (section.description) keys.push(`section.${section.id}.description`);
    for (const field of section.fields) {
      keys.push(`field.${field.id}.label`);
      if (field.help_text) keys.push(`field.${field.id}.help_text`);
      for (const option of field.options ?? []) keys.push(`option.${field.id}.${option.id}.label`);
    }
  }
  return keys;
}

export function sourceStrings(schema: FormSchema): Record<string, string> {
  const strings: Record<string, string> = { 'form.title': schema.title };
  if (schema.description) strings['form.description'] = schema.description;
  for (const section of schema.sections) {
    strings[`section.${section.id}.title`] = section.title;
    if (section.description) strings[`section.${section.id}.description`] = section.description;
    for (const field of section.fields) {
      strings[`field.${field.id}.label`] = field.label;
      if (field.help_text) strings[`field.${field.id}.help_text`] = field.help_text;
      for (const option of field.options ?? []) strings[`option.${field.id}.${option.id}.label`] = option.label;
    }
  }
  return strings;
}

export function validateTranslationStrings(schema: FormSchema, strings: unknown): { valid: true; completeness: number } | { valid: false; error: string } {
  if (!isRecord(strings)) return { valid: false, error: 'Translation must be an object.' };
  const expected = translationKeys(schema);
  const missing = expected.filter((key) => typeof strings[key] !== 'string' || !strings[key].trim());
  const unknown = Object.keys(strings).filter((key) => !expected.includes(key));
  if (unknown.length) return { valid: false, error: `Unknown translation key: ${unknown[0]}` };
  if (missing.length) return { valid: false, error: `Missing translation key: ${missing[0]}` };
  return { valid: true, completeness: expected.length ? 1 : 0 };
}

export function localizedSchema(schema: FormSchema, strings: Record<string, string>): FormSchema {
  const next = structuredClone(schema);
  next.title = strings['form.title'] || next.title;
  next.description = strings['form.description'] || next.description;
  for (const section of next.sections) {
    section.title = strings[`section.${section.id}.title`] || section.title;
    section.description = strings[`section.${section.id}.description`] || section.description;
    for (const field of section.fields) {
      field.label = strings[`field.${field.id}.label`] || field.label;
      field.help_text = strings[`field.${field.id}.help_text`] || field.help_text;
      for (const option of field.options ?? []) option.label = strings[`option.${field.id}.${option.id}.label`] || option.label;
    }
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
