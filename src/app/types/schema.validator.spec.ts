import { validFormSchema } from './schema.fixtures';
import { isFormSchema, validateFormSchema } from './schema.validator';

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
});
