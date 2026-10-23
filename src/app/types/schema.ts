export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'single_choice'
  | 'multiple_choice'
  | 'number'
  | 'email'
  | 'date'
  | 'rating'
  | 'consent';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal';

export interface Condition {
  field_id: string;
  operator: ConditionOperator;
  value: unknown;
}

export interface ValidationRule {
  required?: boolean;
  min_length?: number;
  max_length?: number;
  min?: number;
  max?: number;
  pattern?: string;
  custom_message?: string;
}

export interface Option {
  id: string;
  label: string;
}

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  help_text?: string;
  required?: boolean;
  validation?: ValidationRule;
  options?: Option[];
  condition?: Condition;
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  fields: Field[];
  condition?: Condition;
}

export interface FormSchema {
  schema_version: number;
  title: string;
  description?: string;
  default_locale: string;
  enabled_locales: string[];
  sections: Section[];
}

export interface FormTranslation {
  form_version_id: string;
  locale: string;
  strings: Record<string, string>;
  status: 'complete' | 'partial' | 'pending';
  provider?: string;
  model?: string;
  updated_at: string;
}

export interface FormVersion {
  id: string;
  form_id: string;
  version_number: number;
  schema_json: FormSchema;
  creator: string;
  published_at: string | null;
  created_at: string;
}

export interface Form {
  id: string;
  workspace_id: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface WorkspaceMember {
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

export interface Response {
  id: string;
  form_id: string;
  form_version_id: string;
  submitted_at: string;
  respondent_locale: string;
  status: 'submitted' | 'partial';
  idempotency_ref: string;
}

export interface ResponseAnswer {
  response_id: string;
  field_id: string;
  value_json: unknown;
  original_text?: string;
  original_locale?: string;
}

export interface AnswerTranslation {
  answer_id: string;
  target_locale: string;
  text: string;
  provider?: string;
  model?: string;
  status: 'complete' | 'failed' | 'pending';
}

export interface AIJob {
  id: string;
  workspace_id: string;
  type: 'generate_form' | 'propose_form_edit' | 'translate_form' | 'translate_response';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  provider?: string;
  model?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  workspace_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type AIProposeEditOp =
  | { op: 'add_section'; section: Section; at_index?: number }
  | { op: 'update_section'; section_id: string; changes: Partial<Section> }
  | { op: 'remove_section'; section_id: string }
  | { op: 'add_field'; section_id: string; field: Field; at_index?: number }
  | { op: 'update_field'; field_id: string; changes: Partial<Field> }
  | { op: 'remove_field'; field_id: string }
  | { op: 'reorder_fields'; section_id: string; field_ids: string[] }
  | { op: 'update_validation'; field_id: string; validation: ValidationRule }
  | { op: 'update_form_metadata'; changes: { title?: string; description?: string; default_locale?: string; enabled_locales?: string[] } };

export interface AIProposeEditResult {
  ops: AIProposeEditOp[];
  explanation: string;
  diff_summary: string;
}

export interface AIGenerateFormResult {
  schema: FormSchema;
  explanation: string;
  validation_findings: string[];
}

export interface AITranslateFormResult {
  strings: Record<string, string>;
  completeness: number;
  low_confidence_keys: string[];
  missing_keys: string[];
}