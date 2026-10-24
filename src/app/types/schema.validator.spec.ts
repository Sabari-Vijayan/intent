import { validFormSchema } from './schema.fixtures';
import { isFormSchema, validateFormSchema } from './schema.validator';
import { applyFormEditOperations } from './schema.edits';
import { localizedSchema, sourceStrings, validateTranslationStrings } from './schema.translation';

describe('schema validator', () => {
  it('accepts a valid schema fixture', () => {
    const result = validateFormSchema(validFormSchema);

    expect(result.valid).toBeTrue();
    expect(isFormSchema(validFormSchema)).toBeTrue();
  });

  it('rejects unsupported field types', () => {
    const schema = structuredClone(validFormSchema) as unknown as Record<string, unknown>;
    const sections = schema['sections'] as Array<Record<string, unknown>>;
    const fields = sections[0]['fields'] as Array<Record<string, unknown>>;
    fields[0]['type'] = 'html';

    const result = validateFormSchema(schema);

    expect(result.valid).toBeFalse();
    if (!result.valid)
      expect(result.errors.some((error) => error.path.endsWith('.type'))).toBeTrue();
  });

  it('rejects duplicate IDs and unknown properties', () => {
    const schema = structuredClone(validFormSchema) as unknown as Record<string, unknown>;
    schema['unexpected'] = true;
    const sections = schema['sections'] as Array<Record<string, unknown>>;
    const fields = sections[0]['fields'] as Array<Record<string, unknown>>;
    fields[1]['id'] = fields[0]['id'];

    const result = validateFormSchema(schema);

    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((error) => error.message === 'Unknown property.')).toBeTrue();
      expect(
        result.errors.some((error) => error.message === 'Field ID must be unique.')
      ).toBeTrue();
    }
  });

  it('rejects invalid choice fields and dangling conditions', () => {
    const schema = structuredClone(validFormSchema) as unknown as Record<string, unknown>;
    const sections = schema['sections'] as Array<Record<string, unknown>>;
    const fields = sections[0]['fields'] as Array<Record<string, unknown>>;
    fields[2]['options'] = [];
    fields[3]['condition'] = { field_id: 'missing', operator: 'equals', value: 'x' };

    const result = validateFormSchema(schema);

    expect(result.valid).toBeFalse();
    if (!result.valid) {
      expect(result.errors.some((error) => error.path.endsWith('.options'))).toBeTrue();
      expect(
        result.errors.some((error) => error.message === 'Condition references an unknown field.')
      ).toBeTrue();
    }
  });

  it('rejects malformed top-level values', () => {
    expect(validateFormSchema(null).valid).toBeFalse();
    expect(validateFormSchema({}).valid).toBeFalse();
  });

  it('applies typed edits while preserving stable IDs', () => {
    const schema = applyFormEditOperations(validFormSchema, [
      { op: 'update_field', field_id: 'fld_rating', changes: { label: 'Updated question' } },
      { op: 'reorder_fields', section_id: 'sec_main', field_ids: ['fld_details', 'fld_rating', 'fld_topic', 'fld_name'] },
    ]);

    expect(schema.sections[0].fields[0].id).toBe('fld_details');
    expect(schema.sections[0].fields[1].label).toBe('Updated question');
  });

  it('rejects edits that change IDs or produce an invalid schema', () => {
    expect(() =>
      applyFormEditOperations(validFormSchema, [
        { op: 'update_field', field_id: 'fld_rating', changes: { id: 'new_id' } },
      ])
    ).toThrowError();
    expect(() =>
      applyFormEditOperations(validFormSchema, [
        { op: 'remove_section', section_id: 'sec_main' },
      ])
    ).toThrowError();
  });

  it('validates and applies translations without changing schema IDs or semantics', () => {
    const strings = sourceStrings(validFormSchema);
    strings['form.title'] = 'Translated title';
    expect(validateTranslationStrings(validFormSchema, strings).valid).toBeTrue();
    const translated = localizedSchema(validFormSchema, strings);
    expect(translated.title).toBe('Translated title');
    expect(translated.sections[0].fields[0].id).toBe(validFormSchema.sections[0].fields[0].id);
    expect(translated.sections[0].fields[0].type).toBe(validFormSchema.sections[0].fields[0].type);
  });

  it('rejects incomplete or unknown translation keys', () => {
    const strings = sourceStrings(validFormSchema);
    delete strings['form.title'];
    expect(validateTranslationStrings(validFormSchema, strings).valid).toBeFalse();
    expect(validateTranslationStrings(validFormSchema, { ...sourceStrings(validFormSchema), extra: 'x' }).valid).toBeFalse();
  });
});
