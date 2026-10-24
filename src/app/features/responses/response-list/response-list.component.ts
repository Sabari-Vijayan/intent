import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseDataService } from '../../../core/supabase/supabase-data.service';
import { Field, Response, ResponseAnswer } from '../../../types/schema';

interface ReviewedResponse {
  response: Response;
  answers: ResponseAnswer[];
}

@Component({
  selector: 'app-response-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <div>
           <a routerLink="/forms" class="back-link">← My forms</a>
          <h1>Responses</h1>
        </div>
        <button
          class="btn btn-primary"
          type="button"
          (click)="exportCsv()"
          [disabled]="responses().length === 0"
        >
          Export CSV
        </button>
      </div>
      @if (error()) {
        <div class="notice error" role="alert">{{ error() }}</div>
      }
      @if (loading()) {
        <div class="card">
          <div class="card-body"><p role="status">Loading responses…</p></div>
        </div>
      }
      @if (!loading() && responses().length === 0) {
        <div class="card">
          <div class="empty-state">
            <h2 class="empty-state-title">No responses yet</h2>
            <p>Submitted responses will appear here.</p>
          </div>
        </div>
      }
      @if (!loading() && responses().length > 0) {
        @for (item of visibleResponses(); track item.response.id) {
          <article class="card response-card">
            <div class="card-header">
              <strong>{{ item.response.submitted_at | date: 'medium' }}</strong
              ><span class="meta">{{ item.response.respondent_locale }}</span>
            </div>
            <div class="card-body">
              <dl>
                @for (answer of item.answers; track answer.field_id) {
                  <div class="answer">
                    <dt>{{ fieldLabel(answer.field_id) }}</dt>
                    <dd>{{ displayAnswer(answer) }}</dd>
                  </div>
                }
              </dl>
            </div>
          </article>
        }
        <div class="pagination">
          <button
            class="btn btn-secondary btn-sm"
            type="button"
            (click)="page.set(page() - 1)"
            [disabled]="page() === 0"
          >
            Previous</button
          ><span>Page {{ page() + 1 }} of {{ pageCount() }}</span
          ><button
            class="btn btn-secondary btn-sm"
            type="button"
            (click)="page.set(page() + 1)"
            [disabled]="page() + 1 >= pageCount()"
          >
            Next
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .back-link {
        display: block;
        margin-bottom: var(--space-2);
        font-size: var(--text-sm);
      }
      .response-card {
        margin-bottom: var(--space-4);
        overflow: hidden;
      }
      .response-card .card-header {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
        background: #f1f3ef;
      }
      .meta {
        color: var(--color-text-muted);
        font-size: var(--text-sm);
      }
      .answer {
        display: grid;
        grid-template-columns: minmax(120px, 0.35fr) 1fr;
        gap: var(--space-4);
        padding: var(--space-2) 0;
        border-bottom: 1px solid var(--color-border);
      }
      .answer:last-child {
        border-bottom: 0;
      }
      .answer dt {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .answer dd {
        margin: 0;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        color: var(--color-text);
      }
      .notice.error {
        color: var(--color-error);
        background: var(--color-error-subtle);
        padding: var(--space-3);
        border-radius: var(--radius-md);
        margin-bottom: var(--space-4);
      }
      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--space-4);
        margin: var(--space-6) 0;
      }
      @media (max-width: 560px) {
        .page-header .btn {
          width: 100%;
        }
        .response-card .card-header {
          align-items: flex-start;
          flex-direction: column;
        }
        .answer {
          display: block;
          padding: var(--space-3) 0;
        }
        .answer dt {
          margin-bottom: var(--space-1);
          font-size: var(--text-xs);
        }
        .pagination {
          justify-content: space-between;
          gap: var(--space-2);
        }
        .pagination span {
          font-size: var(--text-sm);
          white-space: nowrap;
        }
      }
    `,
  ],
})
export class ResponseListComponent {
  private readonly data = inject(SupabaseDataService);
  private readonly route = inject(ActivatedRoute);
  responses = signal<ReviewedResponse[]>([]);
  loading = signal(true);
  error = signal('');
  page = signal(0);
  fieldLabels = signal<Record<string, string>>({});
  private readonly fields = signal<Record<string, Field>>({});
  readonly pageSize = 10;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const formId = this.route.snapshot.paramMap.get('id');
      if (!formId) throw new Error('Form ID is missing.');
      const form = await this.data.formWithCurrentVersion(formId);
      if (form.version) {
        const allFields = form.version.schema_json.sections.flatMap((section) => section.fields);
        this.fieldLabels.set(Object.fromEntries(allFields.map((field) => [field.id, field.label])));
        this.fields.set(Object.fromEntries(allFields.map((field) => [field.id, field])));
      }
      this.responses.set(await this.data.responsesForForm(formId));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load responses.');
    } finally {
      this.loading.set(false);
    }
  }

  visibleResponses(): ReviewedResponse[] {
    return this.responses().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize);
  }
  pageCount(): number {
    return Math.max(1, Math.ceil(this.responses().length / this.pageSize));
  }
  displayValue(value: unknown): string {
    return Array.isArray(value)
      ? value.join(', ')
      : typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value ?? '');
  }

  fieldLabel(fieldId: string): string {
    return this.fieldLabels()[fieldId] ?? fieldId;
  }

  displayAnswer(answer: ResponseAnswer): string {
    const field = this.fields()[answer.field_id];
    const optionLabels = new Map((field?.options ?? []).map((option) => [option.id, option.label]));
    if (Array.isArray(answer.value_json)) {
      return answer.value_json
        .map((value) => optionLabels.get(String(value)) ?? String(value))
        .join(', ');
    }
    return optionLabels.get(String(answer.value_json)) ?? this.displayValue(answer.value_json);
  }

  exportCsv(): void {
    const rows = [['submitted_at', 'respondent_locale', 'field_id', 'answer']];
    this.responses().forEach((item) =>
      item.answers.forEach((answer) =>
        rows.push([
          item.response.submitted_at,
          item.response.respondent_locale,
          answer.field_id,
          this.displayValue(answer.value_json),
        ])
      )
    );
    const csv = rows
      .map((row) =>
        row.map((value) => `"${this.safeCsvValue(value).replaceAll('"', '""')}"`).join(',')
      )
      .join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'responses.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private safeCsvValue(value: string): string {
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }
}
