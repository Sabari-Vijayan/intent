import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SupabaseDataService } from '../../../core/supabase/supabase-data.service';
import { SchemaFormRendererComponent } from '../../../shared/forms/schema-form-renderer/schema-form-renderer.component';
import { FormSchema } from '../../../types/schema';

@Component({
  selector: 'app-public-form',
  standalone: true,
  imports: [CommonModule, FormsModule, SchemaFormRendererComponent],
  template: `
    <div class="container public-form-shell">
      @if (loading()) {
        <div class="card">
          <div class="card-body"><p role="status">Loading form…</p></div>
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
              ><select class="input" id="locale" [(ngModel)]="locale">
                <option *ngFor="let supported of schema()!.enabled_locales" [value]="supported">
                  {{ supported }}
                </option>
              </select>
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
            <h1>Thank you</h1>
            <p>Your response has been submitted successfully.</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .locale-row {
        max-width: 220px;
        margin-bottom: var(--space-6);
      }
      .public-form-shell {
        max-width: 720px;
      }
      .success {
        text-align: center;
        padding: var(--space-10);
      }
      .success h1 {
        margin-bottom: var(--space-3);
      }
      @media (max-width: 640px) {
        .public-form-shell {
          padding-inline: 10px;
        }
        .public-form-shell > .card .card-body {
          padding: 20px 16px;
        }
        .locale-row {
          max-width: none;
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
  private formId = '';
  private versionId = '';
  locale = 'en';
  loading = signal(true);
  submitting = signal(false);
  success = signal(false);
  error = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const slug = this.route.snapshot.paramMap.get('slug');
      if (!slug) throw new Error('Form link is incomplete.');
      const result = await this.data.publishedFormBySlug(slug);
      this.formId = result.form.id;
      this.versionId = result.version.id;
      this.schema.set(result.version.schema_json);
      this.locale = result.version.schema_json.default_locale;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load this form.');
    } finally {
      this.loading.set(false);
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
