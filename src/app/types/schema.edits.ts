import { AIProposeEditOp, Field, FormSchema, Section } from './schema';
import { validateFormSchema } from './schema.validator';

/** Applies only typed, ID-addressed operations and validates the complete result. */
export function applyFormEditOperations(schema: FormSchema, ops: AIProposeEditOp[]): FormSchema {
  const next = structuredClone(schema);

  for (const op of ops) {
    switch (op.op) {
      case 'add_section': {
        if (next.sections.some((section) => section.id === op.section.id)) {
          throw new Error(`Section ID already exists: ${op.section.id}`);
        }
        const index = clampIndex(op.at_index, next.sections.length);
        next.sections.splice(index, 0, structuredClone(op.section));
        break;
      }
      case 'update_section': {
        const section = findSection(next, op.section_id);
        assertNoIdChange(op.changes, 'section');
        Object.assign(section, structuredClone(op.changes));
        break;
      }
      case 'remove_section': {
        const index = next.sections.findIndex((section) => section.id === op.section_id);
        if (index < 0) throw new Error(`Unknown section ID: ${op.section_id}`);
        next.sections.splice(index, 1);
        break;
      }
      case 'add_field': {
        const section = findSection(next, op.section_id);
        if (allFields(next).some((field) => field.id === op.field.id)) {
          throw new Error(`Field ID already exists: ${op.field.id}`);
        }
        const index = clampIndex(op.at_index, section.fields.length);
        section.fields.splice(index, 0, structuredClone(op.field));
        break;
      }
      case 'update_field': {
        const field = findField(next, op.field_id);
        assertNoIdChange(op.changes, 'field');
        Object.assign(field, structuredClone(op.changes));
        break;
      }
      case 'remove_field': {
        const location = locateField(next, op.field_id);
        if (!location) throw new Error(`Unknown field ID: ${op.field_id}`);
        location.section.fields.splice(location.index, 1);
        break;
      }
      case 'reorder_fields': {
        const section = findSection(next, op.section_id);
        const currentIds = section.fields.map((field) => field.id);
        if (op.field_ids.length !== currentIds.length || new Set(op.field_ids).size !== currentIds.length) {
          throw new Error(`Reorder must include every field in section ${op.section_id} exactly once.`);
        }
        if (op.field_ids.some((id) => !currentIds.includes(id))) {
          throw new Error(`Reorder contains an unknown field in section ${op.section_id}.`);
        }
        section.fields = op.field_ids.map((id) => section.fields.find((field) => field.id === id)!);
        break;
      }
      case 'update_validation': {
        const field = findField(next, op.field_id);
        field.validation = structuredClone(op.validation);
        break;
      }
      case 'update_form_metadata':
        Object.assign(next, structuredClone(op.changes));
        break;
    }
  }

  const validation = validateFormSchema(next);
  if (!validation.valid) throw new Error(`Edit produced an invalid schema: ${validation.errors[0].message}`);
  return next;
}

export function describeFormEditOperations(ops: AIProposeEditOp[]): string[] {
  return ops.map((op) => {
    switch (op.op) {
      case 'add_section': return `Add section “${op.section.title}”`;
      case 'update_section': return `Update section ${op.section_id}`;
      case 'remove_section': return `Remove section ${op.section_id}`;
      case 'add_field': return `Add ${op.field.type} question “${op.field.label}”`;
      case 'update_field': return `Update question ${op.field_id}`;
      case 'remove_field': return `Remove question ${op.field_id}`;
      case 'reorder_fields': return `Reorder questions in ${op.section_id}`;
      case 'update_validation': return `Update validation for ${op.field_id}`;
      case 'update_form_metadata': return 'Update form details';
    }
  });
}

function findSection(schema: FormSchema, id: string): Section {
  const section = schema.sections.find((item) => item.id === id);
  if (!section) throw new Error(`Unknown section ID: ${id}`);
  return section;
}

function findField(schema: FormSchema, id: string): Field {
  const location = locateField(schema, id);
  if (!location) throw new Error(`Unknown field ID: ${id}`);
  return location.section.fields[location.index];
}

function locateField(schema: FormSchema, id: string): { section: Section; index: number } | null {
  for (const section of schema.sections) {
    const index = section.fields.findIndex((field) => field.id === id);
    if (index >= 0) return { section, index };
  }
  return null;
}

function allFields(schema: FormSchema): Field[] {
  return schema.sections.flatMap((section) => section.fields);
}

function clampIndex(value: number | undefined, length: number): number {
  return Math.max(0, Math.min(value ?? length, length));
}

function assertNoIdChange(changes: object, kind: string): void {
  if ('id' in changes) throw new Error(`AI edits cannot change a ${kind} ID.`);
}
