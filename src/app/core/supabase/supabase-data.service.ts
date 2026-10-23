import { Injectable, inject } from '@angular/core';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.provider';
import {
  Form,
  FormSchema,
  FormVersion,
  Response,
  ResponseAnswer,
  Workspace,
} from '../../types/schema';

@Injectable({ providedIn: 'root' })
export class SupabaseDataService {
  private readonly client = inject<SupabaseClient>(SUPABASE_CLIENT);

  async currentUser(): Promise<User | null> {
    const { data } = await this.client.auth.getUser();
    return data.user;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async workspaceForCurrentUser(): Promise<Workspace | null> {
    const user = await this.currentUser();
    if (!user) return null;
    const { data, error } = await this.client
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data as Workspace | null;
  }

  async listForms(): Promise<Form[]> {
    const { data, error } = await this.client
      .from('forms')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Form[];
  }

  async createForm(workspaceId: string, schema: FormSchema, slug: string): Promise<FormVersion> {
    const user = await this.requireUser();
    const { data: form, error: formError } = await this.client
      .from('forms')
      .insert({ workspace_id: workspaceId, slug, status: 'draft' })
      .select()
      .single();
    if (formError) throw formError;
    const { data: version, error: versionError } = await this.client
      .from('form_versions')
      .insert({ form_id: form.id, version_number: 1, schema_json: schema, creator: user.id })
      .select()
      .single();
    if (versionError) throw versionError;
    return version as FormVersion;
  }

  async formWithCurrentVersion(
    formId: string
  ): Promise<{ form: Form; version: FormVersion | null }> {
    const { data: form, error: formError } = await this.client
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();
    if (formError) throw formError;
    if (!form.current_version_id) return { form: form as Form, version: null };
    const { data: version, error: versionError } = await this.client
      .from('form_versions')
      .select('*')
      .eq('id', form.current_version_id)
      .single();
    if (versionError) throw versionError;
    return { form: form as Form, version: version as FormVersion };
  }

  async saveDraft(formId: string, schema: FormSchema): Promise<FormVersion> {
    const user = await this.requireUser();
    const { data: latest, error: latestError } = await this.client
      .from('form_versions')
      .select('version_number')
      .eq('form_id', formId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    const { data: version, error: versionError } = await this.client
      .from('form_versions')
      .insert({
        form_id: formId,
        version_number: (latest?.version_number ?? 0) + 1,
        schema_json: schema,
        creator: user.id,
      })
      .select()
      .single();
    if (versionError) throw versionError;
    const { error: formError } = await this.client
      .from('forms')
      .update({
        current_version_id: version.id,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId);
    if (formError) throw formError;
    return version as FormVersion;
  }

  async publishDraft(formId: string, schema: FormSchema): Promise<FormVersion> {
    const version = await this.saveDraft(formId, schema);
    const { data: published, error: versionError } = await this.client
      .from('form_versions')
      .update({ published_at: new Date().toISOString() })
      .eq('id', version.id)
      .select()
      .single();
    if (versionError) throw versionError;
    const { error: formError } = await this.client
      .from('forms')
      .update({
        status: 'published',
        current_version_id: version.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId);
    if (formError) throw formError;
    return published as FormVersion;
  }

  async publishedFormBySlug(slug: string): Promise<{ form: Form; version: FormVersion }> {
    const { data: form, error: formError } = await this.client
      .from('forms')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();
    if (formError) throw formError;
    const { data: version, error: versionError } = await this.client
      .from('form_versions')
      .select('*')
      .eq('id', form.current_version_id)
      .not('published_at', 'is', null)
      .single();
    if (versionError) throw versionError;
    return { form: form as Form, version: version as FormVersion };
  }

  async submitResponse(
    formId: string,
    versionId: string,
    locale: string,
    answers: Record<string, unknown>
  ): Promise<Response> {
    const { data: response, error: responseError } = await this.client
      .from('responses')
      .insert({
        form_id: formId,
        form_version_id: versionId,
        respondent_locale: locale,
        idempotency_ref: crypto.randomUUID(),
      })
      .select()
      .single();
    if (responseError) throw responseError;
    const answerRows = Object.entries(answers).map(([field_id, value_json]) => ({
      response_id: response.id,
      field_id,
      value_json,
    }));
    if (answerRows.length > 0) {
      const { error: answersError } = await this.client.from('response_answers').insert(answerRows);
      if (answersError) throw answersError;
    }
    return response as Response;
  }

  async responsesForForm(
    formId: string
  ): Promise<Array<{ response: Response; answers: ResponseAnswer[] }>> {
    const { data: responses, error: responseError } = await this.client
      .from('responses')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });
    if (responseError) throw responseError;
    if (!responses || responses.length === 0) return [];
    const responseIds = responses.map((response) => response.id);
    const { data: answers, error: answersError } = await this.client
      .from('response_answers')
      .select('*')
      .in('response_id', responseIds);
    if (answersError) throw answersError;
    return responses.map((response) => ({
      response: response as Response,
      answers: (answers ?? []).filter(
        (answer) => answer.response_id === response.id
      ) as ResponseAnswer[],
    }));
  }

  private async requireUser(): Promise<User> {
    const user = await this.currentUser();
    if (!user) throw new Error('You must be signed in to perform this action.');
    return user;
  }
}
