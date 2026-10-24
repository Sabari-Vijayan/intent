import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SupabaseDataService } from '../../../core/supabase/supabase-data.service';
import { SchemaFormRendererComponent } from '../../../shared/forms/schema-form-renderer/schema-form-renderer.component';
import { FormSchema } from '../../../types/schema';
import { localizedSchema, validateTranslationStrings } from '../../../types/schema.translation';

@Component({
  selector: 'app-public-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SchemaFormRendererComponent],
  template: `
    <div class="container public-form-shell">
      @if (loading()) {
        <div class="public-loading" role="status">
          <span class="public-loading-mark" aria-hidden="true">✦</span>
          <strong>Preparing your form</strong>
          <span>Just a moment…</span>
        </div>
      }
      @if (error()) {
        <div class="card">
          <div class="card-body">
            <h1>Form unavailable</h1>
            <p role="alert">{{ error() }}</p>
          </div>
        </div>
      }
      @if (schema() && !success()) {
        <div class="card">
          <div class="card-body">
            <div class="locale-row">
              <label class="label" for="locale">Language</label
              ><select class="input" id="locale" [(ngModel)]="locale" (ngModelChange)="changeLocale($event)" [disabled]="translationLoading()">
                <option *ngFor="let supported of schema()!.enabled_locales" [value]="supported">
                  {{ supported }}
                </option>
              </select>
              @if (translationLoading()) { <span class="help-text" role="status">Loading translation…</span> }
              @if (translationNotice()) { <span class="help-text" role="status">{{ translationNotice() }}</span> }
            </div>
            <app-schema-form-renderer
              [schema]="schema()!"
              [submitting]="submitting()"
              (submitted)="submit($event)"
            />
          </div>
        </div>
      }
      @if (success()) {
        <div class="card">
          <div class="card-body success">
            <div class="success-mark" aria-hidden="true">✓</div>
            <h1>Thank you</h1>
            <p>Your response has been submitted successfully.</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .public-form-shell {
        max-width: 680px;
        padding-bottom: var(--space-8);
      }
      .public-form-shell > .card {
        border: 0;
        background: transparent;
        box-shadow: none;
      }
      .public-form-shell > .card .card-body { padding: 0; }
      .public-loading {
        display: grid;
        justify-items: center;
        gap: 10px;
        padding: 62px 20px;
        border: 1px solid #e4e4db;
        border-radius: 3px;
        background: #fffefa;
        color: var(--color-text-muted);
        box-shadow: 0 13px 26px rgb(35 35 28 / 0.05);
        animation: public-loading-arrive .35s ease-out both;
      }
      .public-loading strong { color: var(--color-text); font: 400 1.65rem var(--font-display); letter-spacing: -.04em; }
      .public-loading-mark { color: var(--color-success); font-size: 1.2rem; animation: public-loading-float 1.2s ease-in-out infinite; }
      .locale-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        margin-bottom: 18px;
      }
      .locale-row .label { margin: 0; color: var(--color-text-muted); font-size: .72rem; font-weight: 500; }
      .locale-row .input { width: auto; min-width: 150px; padding-block: 7px; border-radius: 999px; background: #fffefa; }
      .success {
        text-align: center;
        padding: var(--space-10);
      }
      .success-mark {
        display: grid;
        place-items: center;
        width: 52px;
        height: 52px;
        margin: 0 auto 18px;
        border-radius: 50%;
        background: #e8f0e8;
        color: #597a60;
        font: 1.8rem var(--font-display);
        animation: success-pop .45s cubic-bezier(.2,.8,.2,1) both;
      }
      @keyframes success-pop { from { opacity: 0; transform: scale(.7) rotate(-8deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
      @keyframes public-loading-arrive { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes public-loading-float { 0%, 100% { transform: translateY(1px) rotate(-8deg); } 50% { transform: translateY(-3px) rotate(8deg); } }
      @media (prefers-reduced-motion: reduce) { .success-mark, .public-loading, .public-loading-mark { animation: none; } }
      .success h1 {
        margin-bottom: var(--space-3);
      }
      @media (max-width: 640px) {
        .public-form-shell {
          padding-inline: 10px;
        }
        .locale-row {
          margin-bottom: var(--space-5);
        }
        .success {
          padding: var(--space-8) var(--space-3);
        }
      }
    `,
  ],
})
export class PublicFormComponent {
  private readonly data = inject(SupabaseDataService);
  private readonly route = inject(ActivatedRoute);
  schema = signal<FormSchema | null>(null);
  private sourceSchema = signal<FormSchema | null>(null);
  private formId = '';
  private versionId = '';
  locale = 'en';
  loading = signal(true);
  submitting = signal(false);
  success = signal(false);
  error = signal('');
  translationLoading = signal(false);
  translationNotice = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const formId = this.route.snapshot.paramMap.get('formId');
      if (!formId) throw new Error('Form link is incomplete.');
      const result = await this.data.publishedFormById(formId);
      this.formId = result.form.id;
      this.versionId = result.version.id;
       this.sourceSchema.set(result.version.schema_json);
       this.schema.set(result.version.schema_json);
       const requestedLocale = this.route.snapshot.queryParamMap.get('locale');
       this.locale = requestedLocale && result.version.schema_json.enabled_locales.includes(requestedLocale)
         ? requestedLocale
         : result.version.schema_json.default_locale;
       if (this.locale !== result.version.schema_json.default_locale) await this.changeLocale(this.locale);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load this form.');
    } finally {
      this.loading.set(false);
    }
  }

  async changeLocale(locale: string): Promise<void> {
    const source = this.sourceSchema();
    if (!source) return;
    this.locale = locale;
    if (locale === source.default_locale) {
      this.schema.set(source);
      this.translationNotice.set('');
      return;
    }
    this.translationLoading.set(true);
    try {
      const translation = await this.data.formTranslation(this.versionId, locale);
      if (!translation) throw new Error('This language is not available yet. Showing the source language.');
      const validation = validateTranslationStrings(source, translation.strings);
      if (!validation.valid && !validation.error.startsWith('Missing translation key:')) throw new Error('This translation is invalid. Showing the source language.');
      this.schema.set(localizedSchema(source, translation.strings));
      this.translationNotice.set('');
    } catch (error) {
      this.schema.set(source);
      this.translationNotice.set(error instanceof Error ? error.message : 'Could not load this translation.');
    } finally {
      this.translationLoading.set(false);
    }
  }

  async submit(answers: Record<string, unknown>): Promise<void> {
    if (this.submitting() || this.success()) return;
    this.submitting.set(true);
    this.error.set('');
    try {
      await this.data.submitResponse(this.formId, this.versionId, this.locale, answers);
      this.success.set(true);
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Could not submit your response. Please try again.'
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
