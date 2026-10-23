import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseDataService } from '../../../core/supabase/supabase-data.service';

interface FormItem {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  updated_at: string;
}

@Component({
  selector: 'app-form-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container">
      <div class="page-header">
        <h1>Forms</h1>
        <a routerLink="/forms/new" class="btn btn-primary">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Form
        </a>
      </div>

      @if (forms().length === 0) {
        <div class="card">
          <div class="empty-state">
            <svg
              class="empty-state-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="9" x2="15" y2="15"></line>
              <line x1="15" y1="9" x2="9" y2="15"></line>
            </svg>
            <h2 class="empty-state-title">No forms yet</h2>
            <p>
              {{ loading() ? 'Loading your workspace…' : 'Create your first form to get started.' }}
            </p>
            <a routerLink="/forms/new" class="btn btn-primary" style="margin-top: var(--space-4);"
              >Create Form</a
            >
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th style="width: 120px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (form of forms(); track form.id) {
                  <tr>
                    <td data-label="Title">
                      <a [routerLink]="['/forms', form.id]" class="font-medium">{{ form.title }}</a>
                    </td>
                    <td data-label="Status">
                      <span class="badge" [class]="'badge-' + getStatusClass(form.status)">
                        {{ form.status }}
                      </span>
                    </td>
                    <td data-label="Last updated">{{ form.updated_at | date: 'short' }}</td>
                    <td data-label="Actions">
                      <div class="row-actions">
                        <a [routerLink]="['/forms', form.id]" class="btn btn-ghost btn-sm">Edit</a>
                        <a
                          [routerLink]="['/forms', form.id, 'responses']"
                          class="btn btn-ghost btn-sm"
                          >Responses</a
                        >
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--space-6);
        flex-wrap: wrap;
        gap: var(--space-4);
      }
      .font-medium {
        font-weight: var(--font-medium);
      }
      .row-actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
      }
      @media (max-width: 640px) {
        .page-header {
          align-items: stretch;
          margin-bottom: var(--space-5);
        }
        .page-header .btn {
          width: 100%;
        }
        .table-container {
          overflow: visible;
        }
        table,
        thead,
        tbody,
        tr,
        td {
          display: block;
        }
        thead {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
        }
        tbody {
          padding: var(--space-2);
        }
        tr {
          padding: var(--space-3);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-3);
        }
        td {
          display: grid;
          grid-template-columns: 92px minmax(0, 1fr);
          gap: var(--space-2);
          align-items: center;
          padding: var(--space-2) 0;
          border-bottom: 0;
        }
        td::before {
          content: attr(data-label);
          color: var(--color-text-muted);
          font-size: var(--text-xs);
          font-weight: var(--font-medium);
        }
        td:last-child {
          align-items: start;
        }
        .row-actions {
          gap: var(--space-1);
        }
      }
    `,
  ],
})
export class FormListComponent {
  private readonly data = inject(SupabaseDataService);
  forms = signal<FormItem[]>([]);
  loading = signal(true);
  error = signal('');

  constructor() {
    void this.loadForms();
  }

  private async loadForms(): Promise<void> {
    try {
      const forms = await this.data.listForms();
      this.forms.set(
        forms.map((form) => ({
          id: form.id,
          title: form.slug,
          status: form.status,
          updated_at: form.updated_at,
        }))
      );
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load forms.');
    } finally {
      this.loading.set(false);
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'published':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'neutral';
      default:
        return 'neutral';
    }
  }
}
