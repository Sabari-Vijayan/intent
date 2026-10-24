import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from './supabase.provider';
import {
  Form,
  FormSchema,
  FormVersion,
  Response,
  ResponseAnswer,
  Workspace,
  AIGenerateFormResult,
} from '../../types/schema';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class SupabaseDataService {
  private readonly client = inject<SupabaseClient>(SUPABASE_CLIENT);
  readonly user = signal<User | null>(null);
  readonly authReady = signal(false);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly cacheTtl = {
    workspace: 10 * 60_000,
    forms: 60_000,
    form: 60_000,
    responses: 30_000,
    published: 5 * 60_000,
  } as const;
  private authInitialization?: Promise<void>;

  constructor() {
    this.authInitialization = this.initializeAuth();
    this.client.auth.onAuthStateChange((_event, session) => {
      if (this.user()?.id !== session?.user?.id) this.clearCache();
      this.user.set(session?.user ?? null);
      this.authReady.set(true);
    });
  }

  private async initializeAuth(): Promise<void> {
    const { data } = await this.client.auth.getUser();
    this.user.set(data.user);
    this.authReady.set(true);
  }

  async currentUser(): Promise<User | null> {
    if (this.authReady()) return this.user();
    await this.authInitialization;
    return this.user();
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
    this.user.set(null);
    this.clearCache();
  }

  async generateForm(prompt: string, locale = 'en'): Promise<AIGenerateFormResult> {
    const { data, error } = await this.client.functions.invoke('generate-form', {
      body: { prompt, locale },
    });
    if (error) {
      const response = (error as { context?: { json: () => Promise<unknown> } }).context;
      if (response) {
        try {
          const details = (await response.json()) as Record<string, unknown>;
          if (details['provider_status']) {
            const code = typeof details['provider_code'] === 'string' ? ` (${details['provider_code']})` : '';
            throw new Error(`Sarvam request failed with HTTP ${details['provider_status']}${code}.`);
          }
          if (Array.isArray(details['validation_errors']) && details['validation_errors'].length > 0) {
            const firstError = details['validation_errors'][0];
            if (typeof firstError === 'string') throw new Error(`AI schema validation failed: ${firstError}`);
          }
          if (typeof details['error'] === 'string') throw new Error(details['error']);
        } catch (responseError) {
          if (responseError instanceof Error && responseError.message !== error.message) throw responseError;
        }
      }
      throw error;
    }
    if (!data?.schema) throw new Error(data?.error ?? 'The AI returned no form proposal.');
    return data as AIGenerateFormResult;
  }

  async workspaceForCurrentUser(): Promise<Workspace | null> {
    const user = await this.currentUser();
    if (!user) return null;
    const key = this.userCacheKey('workspace');
    const cached = this.readCache<Workspace | null>(key);
    if (cached !== undefined) return cached;
    const { data, error } = await this.client
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) throw error;
    const workspace = data as Workspace | null;
    this.writeCache(key, workspace, this.cacheTtl.workspace);
    return workspace;
  }

  async listForms(): Promise<Form[]> {
    const key = this.userCacheKey('forms');
    const cached = this.readCache<Form[]>(key);
    if (cached !== undefined) return cached;
    const { data, error } = await this.client
      .from('forms')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    const forms = (data ?? []) as Form[];
    this.writeCache(key, forms, this.cacheTtl.forms);
    return forms;
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
    this.invalidateUserData();
    return version as FormVersion;
  }

  async formWithCurrentVersion(
    formId: string
  ): Promise<{ form: Form; version: FormVersion | null }> {
    const key = this.userCacheKey(`form:${formId}`);
    const cached = this.readCache<{ form: Form; version: FormVersion | null }>(key);
    if (cached !== undefined) return cached;
    const { data: form, error: formError } = await this.client
      .from('forms')
      .select('*')
      .eq('id', formId)
      .single();
    if (formError) throw formError;
    if (!form.current_version_id) {
      const result = { form: form as Form, version: null };
      this.writeCache(key, result, this.cacheTtl.form);
      return result;
    }
    const { data: version, error: versionError } = await this.client
      .from('form_versions')
      .select('*')
      .eq('id', form.current_version_id)
      .single();
    if (versionError) throw versionError;
    const result = { form: form as Form, version: version as FormVersion };
    this.writeCache(key, result, this.cacheTtl.form);
    return result;
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
    this.invalidateForm(formId);
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
    this.invalidateForm(formId);
    this.invalidatePublishedCache();
    return published as FormVersion;
  }

  async publishedFormBySlug(slug: string): Promise<{ form: Form; version: FormVersion }> {
    const key = `published:${slug}`;
    const cached = this.readCache<{ form: Form; version: FormVersion }>(key);
    if (cached !== undefined) return cached;
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
    const result = { form: form as Form, version: version as FormVersion };
    this.writeCache(key, result, this.cacheTtl.published);
    return result;
  }

  async publishedFormById(formId: string): Promise<{ form: Form; version: FormVersion }> {
    const key = `published-id:${formId}`;
    const cached = this.readCache<{ form: Form; version: FormVersion }>(key);
    if (cached !== undefined) return cached;
    const { data: form, error: formError } = await this.client
      .from('forms')
      .select('*')
      .eq('id', formId)
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
    const result = { form: form as Form, version: version as FormVersion };
    this.writeCache(key, result, this.cacheTtl.published);
    return result;
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
    this.cache.delete(this.userCacheKey(`responses:${formId}`));
    return response as Response;
  }

  async responsesForForm(
    formId: string
  ): Promise<Array<{ response: Response; answers: ResponseAnswer[] }>> {
    const key = this.userCacheKey(`responses:${formId}`);
    const cached = this.readCache<Array<{ response: Response; answers: ResponseAnswer[] }>>(key);
    if (cached !== undefined) return cached;
    const { data: responses, error: responseError } = await this.client
      .from('responses')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });
    if (responseError) throw responseError;
    if (!responses || responses.length === 0) {
      this.writeCache(key, [], this.cacheTtl.responses);
      return [];
    }
    const responseIds = responses.map((response) => response.id);
    const { data: answers, error: answersError } = await this.client
      .from('response_answers')
      .select('*')
      .in('response_id', responseIds);
    if (answersError) throw answersError;
    const result = responses.map((response) => ({
      response: response as Response,
      answers: (answers ?? []).filter(
        (answer) => answer.response_id === response.id
      ) as ResponseAnswer[],
    }));
    this.writeCache(key, result, this.cacheTtl.responses);
    return result;
  }

  private userCacheKey(resource: string): string {
    return `${this.user()?.id ?? 'anonymous'}:${resource}`;
  }

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private writeCache<T>(key: string, value: T, ttl: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttl });
  }

  private invalidateForm(formId: string): void {
    this.cache.delete(this.userCacheKey(`form:${formId}`));
    this.cache.delete(this.userCacheKey('forms'));
    this.cache.delete(this.userCacheKey(`responses:${formId}`));
  }

  private invalidateUserData(): void {
    const prefix = `${this.user()?.id ?? 'anonymous'}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  private invalidatePublishedCache(): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith('published:') || key.startsWith('published-id:')) this.cache.delete(key);
    }
  }

  private clearCache(): void {
    this.cache.clear();
  }

  private async requireUser(): Promise<User> {
    const user = await this.currentUser();
    if (!user) throw new Error('You must be signed in to perform this action.');
    return user;
  }
}
