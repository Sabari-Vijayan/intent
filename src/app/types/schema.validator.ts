import { ConditionOperator, Field, FieldType, FormSchema, Section, ValidationRule } from './schema';

export const SCHEMA_LIMITS = {
  maxSections: 20,
  maxFields: 100,
  maxOptionsPerField: 50,
  maxIdLength: 64,
  maxLocaleLength: 16,
  maxTitleLength: 200,
  maxDescriptionLength: 2_000,
  maxLabelLength: 500,
  maxHelpTextLength: 2_000,
  maxValidationMessageLength: 500,
} as const;

const FIELD_TYPES: readonly FieldType[] = [
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

const CONDITION_OPERATORS: readonly ConditionOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
];

const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z][a-z]{2})?$/;
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

export interface SchemaValidationError {
  path: string;
  message: string;
}

export type SchemaValidationResult =
  { valid: true; value: FormSchema } | { valid: false; errors: SchemaValidationError[] };

interface SchemaRecord extends Record<string, unknown> {
  schema_version?: unknown;
  title?: unknown;
  description?: unknown;
  default_locale?: unknown;
  enabled_locales?: unknown;
  sections?: unknown;
  id?: unknown;
  type?: unknown;
  label?: unknown;
  help_text?: unknown;
  required?: unknown;
  validation?: unknown;
  options?: unknown;
  condition?: unknown;
  fields?: unknown;
  field_id?: unknown;
  operator?: unknown;
  value?: unknown;
  min_length?: unknown;
  max_length?: unknown;
  min?: unknown;
  max?: unknown;
  pattern?: unknown;
  custom_message?: unknown;
}

export function validateFormSchema(input: unknown): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];

  if (!isRecord(input)) {
    return invalid('', 'Schema must be an object.');
  }

  checkKeys(
    input,
    ['schema_version', 'title', 'description', 'default_locale', 'enabled_locales', 'sections'],
    '',
    errors
  );
  checkInteger(input.schema_version, 'schema_version', errors, 1, 1);
  checkString(input.title, 'title', errors, 1, SCHEMA_LIMITS.maxTitleLength);
  checkOptionalString(input.description, 'description', errors, SCHEMA_LIMITS.maxDescriptionLength);
  checkLocale(input.default_locale, 'default_locale', errors);

  const locales = input.enabled_locales;
  if (!Array.isArray(locales) || locales.length === 0) {
    errors.push({ path: 'enabled_locales', message: 'At least one enabled locale is required.' });
  } else {
    const seenLocales = new Set<string>();
    locales.forEach((locale, index) => {
      const path = `enabled_locales[${index}]`;
      checkLocale(locale, path, errors);
      if (typeof locale === 'string') {
        if (seenLocales.has(locale)) errors.push({ path, message: 'Locale must be unique.' });
        seenLocales.add(locale);
      }
    });
    if (typeof input.default_locale === 'string' && !seenLocales.has(input.default_locale)) {
      errors.push({ path: 'default_locale', message: 'Default locale must be enabled.' });
    }
  }

  const sections = input.sections;
  if (!Array.isArray(sections)) {
    errors.push({ path: 'sections', message: 'Sections must be an array.' });
  } else {
    if (sections.length === 0) {
      errors.push({ path: 'sections', message: 'At least one section is required.' });
    }
    if (sections.length > SCHEMA_LIMITS.maxSections) {
      errors.push({
        path: 'sections',
        message: `Cannot contain more than ${SCHEMA_LIMITS.maxSections} sections.`,
      });
    }
    const sectionIds = new Set<string>();
    const fieldIds = new Set<string>();
    sections.forEach((section, index) => {
      validateSection(section, `sections[${index}]`, errors, sectionIds, fieldIds);
    });
    if (fieldIds.size > SCHEMA_LIMITS.maxFields) {
      errors.push({
        path: 'sections',
        message: `Cannot contain more than ${SCHEMA_LIMITS.maxFields} fields.`,
      });
    }
    sections.forEach((section, index) => {
      if (isRecord(section) && section.condition !== undefined) {
        validateCondition(section.condition, `sections[${index}].condition`, errors, fieldIds);
      }
      if (isRecord(section) && Array.isArray(section.fields)) {
        section.fields.forEach((field, fieldIndex) => {
          if (isRecord(field) && field.condition !== undefined) {
            validateCondition(
              field.condition,
              `sections[${index}].fields[${fieldIndex}].condition`,
              errors,
              fieldIds
            );
          }
        });
      }
    });
  }

  return errors.length === 0
    ? { valid: true, value: input as unknown as FormSchema }
    : { valid: false, errors };
}

export function isFormSchema(input: unknown): input is FormSchema {
  return validateFormSchema(input).valid;
}

function validateSection(
  input: unknown,
  path: string,
  errors: SchemaValidationError[],
  sectionIds: Set<string>,
  fieldIds: Set<string>
): input is Section {
  if (!isRecord(input)) {
    errors.push({ path, message: 'Section must be an object.' });
    return false;
  }
  checkKeys(input, ['id', 'title', 'description', 'fields', 'condition'], path, errors);
  checkId(input.id, `${path}.id`, errors);
  if (typeof input.id === 'string') {
    if (sectionIds.has(input.id))
      errors.push({ path: `${path}.id`, message: 'Section ID must be unique.' });
    sectionIds.add(input.id);
  }
  checkString(input.title, `${path}.title`, errors, 1, SCHEMA_LIMITS.maxTitleLength);
  checkOptionalString(
    input.description,
    `${path}.description`,
    errors,
    SCHEMA_LIMITS.maxDescriptionLength
  );
  if (input.condition !== undefined)
    validateConditionShape(input.condition, `${path}.condition`, errors);

  if (!Array.isArray(input.fields)) {
    errors.push({ path: `${path}.fields`, message: 'Fields must be an array.' });
  } else {
    input.fields.forEach((field, index) =>
      validateField(field, `${path}.fields[${index}]`, errors, fieldIds)
    );
  }
  return true;
}

function validateField(
  input: unknown,
  path: string,
  errors: SchemaValidationError[],
  fieldIds: Set<string>
): input is Field {
  if (!isRecord(input)) {
    errors.push({ path, message: 'Field must be an object.' });
    return false;
  }
  checkKeys(
    input,
    ['id', 'type', 'label', 'help_text', 'required', 'validation', 'options', 'condition'],
    path,
    errors
  );
  checkId(input.id, `${path}.id`, errors);
  if (typeof input.id === 'string') {
    if (fieldIds.has(input.id))
      errors.push({ path: `${path}.id`, message: 'Field ID must be unique.' });
    fieldIds.add(input.id);
  }
  if (!FIELD_TYPES.includes(input.type as FieldType))
    errors.push({ path: `${path}.type`, message: 'Unsupported field type.' });
  checkString(input.label, `${path}.label`, errors, 1, SCHEMA_LIMITS.maxLabelLength);
  checkOptionalString(
    input.help_text,
    `${path}.help_text`,
    errors,
    SCHEMA_LIMITS.maxHelpTextLength
  );
  checkOptionalBoolean(input.required, `${path}.required`, errors);
  if (input.validation !== undefined)
    validateValidation(input.validation, `${path}.validation`, errors);
  if (input.condition !== undefined)
    validateConditionShape(input.condition, `${path}.condition`, errors);

  const choice = input.type === 'single_choice' || input.type === 'multiple_choice';
  if (choice) {
    if (!Array.isArray(input.options) || input.options.length === 0) {
      errors.push({
        path: `${path}.options`,
        message: 'Choice fields require at least one option.',
      });
    } else {
      validateOptions(input.options, `${path}.options`, errors);
    }
  } else if (input.options !== undefined) {
    errors.push({ path: `${path}.options`, message: 'Only choice fields may define options.' });
  }
  return true;
}

function validateOptions(input: unknown[], path: string, errors: SchemaValidationError[]): void {
  if (input.length > SCHEMA_LIMITS.maxOptionsPerField) {
    errors.push({
      path,
      message: `Cannot contain more than ${SCHEMA_LIMITS.maxOptionsPerField} options.`,
    });
  }
  const ids = new Set<string>();
  input.forEach((option, index) => {
    const optionPath = `${path}[${index}]`;
    if (!isRecord(option)) {
      errors.push({ path: optionPath, message: 'Option must be an object.' });
      return;
    }
    checkKeys(option, ['id', 'label'], optionPath, errors);
    checkId(option.id, `${optionPath}.id`, errors);
    checkString(option.label, `${optionPath}.label`, errors, 1, SCHEMA_LIMITS.maxLabelLength);
    if (typeof option.id === 'string') {
      if (ids.has(option.id))
        errors.push({ path: `${optionPath}.id`, message: 'Option ID must be unique.' });
      ids.add(option.id);
    }
  });
}

function validateValidation(
  input: unknown,
  path: string,
  errors: SchemaValidationError[]
): input is ValidationRule {
  if (!isRecord(input)) {
    errors.push({ path, message: 'Validation must be an object.' });
    return false;
  }
  checkKeys(
    input,
    ['required', 'min_length', 'max_length', 'min', 'max', 'pattern', 'custom_message'],
    path,
    errors
  );
  checkOptionalBoolean(input.required, `${path}.required`, errors);
  ['min_length', 'max_length', 'min', 'max'].forEach((key) => {
    if (input[key] !== undefined) checkNumber(input[key], `${path}.${key}`, errors, 0);
  });
  if (
    typeof input.min_length === 'number' &&
    typeof input.max_length === 'number' &&
    input.min_length > input.max_length
  ) {
    errors.push({ path, message: 'min_length cannot be greater than max_length.' });
  }
  if (typeof input.min === 'number' && typeof input.max === 'number' && input.min > input.max) {
    errors.push({ path, message: 'min cannot be greater than max.' });
  }
  if (input.pattern !== undefined) {
    checkString(input.pattern, `${path}.pattern`, errors, 1, 500);
    if (typeof input.pattern === 'string') {
      try {
        new RegExp(input.pattern);
      } catch {
        errors.push({
          path: `${path}.pattern`,
          message: 'Pattern must be a valid regular expression.',
        });
      }
    }
  }
  checkOptionalString(
    input.custom_message,
    `${path}.custom_message`,
    errors,
    SCHEMA_LIMITS.maxValidationMessageLength
  );
  return true;
}

function validateConditionShape(
  input: unknown,
  path: string,
  errors: SchemaValidationError[]
): void {
  if (!isRecord(input)) {
    errors.push({ path, message: 'Condition must be an object.' });
    return;
  }
  checkKeys(input, ['field_id', 'operator', 'value'], path, errors);
  checkId(input.field_id, `${path}.field_id`, errors);
  if (!CONDITION_OPERATORS.includes(input.operator as ConditionOperator)) {
    errors.push({ path: `${path}.operator`, message: 'Unsupported condition operator.' });
  }
  if (!isConditionValue(input.value))
    errors.push({
      path: `${path}.value`,
      message: 'Condition value must be a JSON scalar or scalar array.',
    });
  if (
    (input.operator === 'is_empty' || input.operator === 'is_not_empty') &&
    input.value !== null
  ) {
    errors.push({ path: `${path}.value`, message: 'Empty checks must use null as their value.' });
  }
}

function validateCondition(
  input: unknown,
  path: string,
  errors: SchemaValidationError[],
  fieldIds: Set<string>
): void {
  validateConditionShape(input, path, errors);
  if (isRecord(input) && typeof input.field_id === 'string' && !fieldIds.has(input.field_id)) {
    errors.push({ path: `${path}.field_id`, message: 'Condition references an unknown field.' });
  }
}

function checkKeys(
  input: Record<string, unknown>,
  allowed: string[],
  path: string,
  errors: SchemaValidationError[]
): void {
  const allowedSet = new Set(allowed);
  Object.keys(input)
    .filter((key) => !allowedSet.has(key))
    .forEach((key) => {
      errors.push({ path: path ? `${path}.${key}` : key, message: 'Unknown property.' });
    });
}

function checkId(value: unknown, path: string, errors: SchemaValidationError[]): void {
  checkString(value, path, errors, 1, SCHEMA_LIMITS.maxIdLength);
  if (typeof value === 'string' && !ID_PATTERN.test(value))
    errors.push({ path, message: 'ID contains invalid characters.' });
}

function checkLocale(value: unknown, path: string, errors: SchemaValidationError[]): void {
  checkString(value, path, errors, 2, SCHEMA_LIMITS.maxLocaleLength);
  if (typeof value === 'string' && !LOCALE_PATTERN.test(value))
    errors.push({ path, message: 'Locale must use a supported BCP-47-like format.' });
}

function checkString(
  value: unknown,
  path: string,
  errors: SchemaValidationError[],
  min: number,
  max: number
): void {
  if (typeof value !== 'string' || value.length < min || value.length > max)
    errors.push({ path, message: `Must be a string with ${min}-${max} characters.` });
}

function checkOptionalString(
  value: unknown,
  path: string,
  errors: SchemaValidationError[],
  max: number
): void {
  if (value !== undefined) checkString(value, path, errors, 1, max);
}

function checkOptionalBoolean(value: unknown, path: string, errors: SchemaValidationError[]): void {
  if (value !== undefined && typeof value !== 'boolean')
    errors.push({ path, message: 'Must be a boolean.' });
}

function checkInteger(
  value: unknown,
  path: string,
  errors: SchemaValidationError[],
  min: number,
  max: number
): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
    errors.push({ path, message: `Must be an integer from ${min} to ${max}.` });
}

function checkNumber(
  value: unknown,
  path: string,
  errors: SchemaValidationError[],
  min: number
): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min)
    errors.push({ path, message: `Must be a number greater than or equal to ${min}.` });
}

function isConditionValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    (Array.isArray(value) &&
      value.every(
        (item) =>
          item === null ||
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean'
      ))
  );
}

function isRecord(value: unknown): value is SchemaRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string, message: string): SchemaValidationResult {
  return { valid: false, errors: [{ path, message }] };
}
