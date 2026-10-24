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
         <div>
           <span class="eyebrow">Your workspace</span>
           <h1>My forms</h1>
         </div>
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

       @if (error()) {
         <div class="notice error" role="alert">{{ error() }}</div>
       }
       @if (loading()) {
         <div class="loading-sheet" role="status" aria-label="Loading your forms">
           <div class="loading-sheet-holes" aria-hidden="true"><i></i><i></i></div>
           <span class="loading-sheet-kicker">intent / your forms</span>
           <strong>Gathering your sheets</strong>
           <div class="loading-rule" aria-hidden="true"></div>
           <span class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>
         </div>
       } @else if (forms().length === 0) {
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
             <p>Create your first form to get started.</p>
            <a routerLink="/forms/new" class="btn btn-primary" style="margin-top: var(--space-4);"
              >Create Form</a
            >
          </div>
        </div>
       } @else {
         <div class="sheet-grid" aria-label="Your forms">
           @for (form of forms(); track form.id) {
             <article class="form-sheet">
               <div class="sheet-hole sheet-hole-one" aria-hidden="true"></div>
               <div class="sheet-hole sheet-hole-two" aria-hidden="true"></div>
               <div class="sheet-topline">
                 <span>intent / form sheet</span>
                 <span class="sheet-status" [class]="'status-' + getStatusClass(form.status)">
                   <i aria-hidden="true"></i>{{ form.status }}
                 </span>
               </div>
               <a [routerLink]="['/forms', form.id]" class="sheet-title">{{ form.title }}</a>
               <div class="sheet-lines" aria-hidden="true"><span></span><span></span><span></span></div>
               <div class="sheet-meta">
                 <span>Last touched</span>
                 <time [attr.datetime]="form.updated_at">{{ form.updated_at | date: 'mediumDate' }}</time>
               </div>
               <div class="sheet-actions">
                 <a [routerLink]="['/forms', form.id]" class="btn btn-secondary btn-sm">Open sheet</a>
                 <div class="sheet-links">
                   @if (form.status === 'published') {
                     <a [href]="publicUrl(form.id)" target="_blank" rel="noopener" class="sheet-live">Live form ↗</a>
                      <button type="button" class="copy-link" [class.copied]="copiedFormId() === form.id" (click)="copyLink(form.id)">
                       {{ copiedFormId() === form.id ? 'Copied' : 'Copy link' }}
                     </button>
                   }
                   <a [routerLink]="['/forms', form.id, 'responses']" class="sheet-responses">Responses <span>↗</span></a>
                 </div>
               </div>
             </article>
           }
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
      .page-header h1 { letter-spacing: -0.045em; }
      .page-header .eyebrow { display: block; margin-bottom: 6px; }
      .notice.error { margin-bottom: var(--space-4); padding: 12px 16px; border-radius: 12px; color: var(--color-error); background: var(--color-error-subtle); }
      .sheet-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
      }
      .form-sheet {
        position: relative;
        min-height: 310px;
        overflow: hidden;
        padding: 26px 28px 22px;
        background: #fffefa;
        border: 1px solid #e4e4db;
        border-radius: 3px 3px 16px 3px;
        box-shadow: 0 13px 26px rgb(35 35 28 / 0.06);
      }
      .form-sheet::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: repeating-linear-gradient(0deg, transparent 0 34px, #edf0e9 35px);
        opacity: .72;
      }
      .form-sheet::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #f1f1e9 50%, transparent 51%);
        border-left: 1px solid #e4e4db;
        border-bottom: 1px solid #e4e4db;
      }
      .form-sheet > * { position: relative; }
      .sheet-hole {
        position: absolute;
        z-index: 2;
        left: -6px;
        width: 12px;
        height: 12px;
        border: 1px solid #dcded6;
        border-radius: 50%;
        background: var(--color-surface);
      }
      .sheet-hole-one { top: 72px; }
      .sheet-hole-two { bottom: 72px; }
      .sheet-topline,
      .sheet-meta,
      .sheet-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .sheet-topline {
         color: #62645e;
        font-size: .65rem;
        letter-spacing: .08em;
        text-transform: lowercase;
      }
      .sheet-status { display: inline-flex; align-items: center; gap: 5px; color: var(--color-text-secondary); }
      .sheet-status i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
      .status-success { color: var(--color-success); }
      .status-warning { color: var(--color-warning); }
      .status-neutral { color: var(--color-text-muted); }
      .sheet-title {
        display: block;
        max-width: 88%;
        margin: 34px 0 22px;
        color: var(--color-text);
        font: 400 clamp(1.7rem, 3vw, 2.35rem)/1.02 var(--font-display);
        letter-spacing: -.04em;
      }
      .sheet-title:hover { color: var(--color-primary-text); text-decoration: none; }
      .sheet-lines { display: grid; gap: 12px; margin-bottom: 24px; }
      .sheet-lines span { display: block; width: 72%; height: 1px; background: #d9ddd4; }
      .sheet-lines span:nth-child(2) { width: 90%; }
      .sheet-lines span:nth-child(3) { width: 54%; }
      .sheet-meta {
        align-items: baseline;
        padding-top: 13px;
        border-top: 1px solid #dfe2d9;
        color: var(--color-text-muted);
        font-size: .72rem;
      }
      .sheet-meta time { color: var(--color-text-secondary); }
      .sheet-actions { margin-top: 18px; }
      .sheet-actions .btn { background: #fff; }
      .sheet-links { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
      .sheet-live, .copy-link { color: var(--color-primary-text); font-size: .72rem; }
      .copy-link { padding: 0; border: 0; background: transparent; cursor: pointer; font-family: inherit; }
      .copy-link.copied { animation: copied-pop .3s ease-out both; }
      .copy-link:hover, .sheet-live:hover { color: var(--color-text); text-decoration: underline; }
      .sheet-responses { color: var(--color-text-secondary); font-size: .76rem; }
      .sheet-responses span { padding-left: 4px; font-size: 1rem; }
      .sheet-responses:hover { color: var(--color-primary-text); text-decoration: none; }
      @media (max-width: 640px) {
        .page-header {
          align-items: stretch;
          margin-bottom: var(--space-5);
        }
        .page-header .btn {
          width: 100%;
        }
        .sheet-grid { grid-template-columns: 1fr; }
        .form-sheet { min-height: 290px; }
      }
    `,
  ],
})
export class FormListComponent {
  private readonly data = inject(SupabaseDataService);
  forms = signal<FormItem[]>([]);
  loading = signal(true);
  error = signal('');
  copiedFormId = signal<string | null>(null);

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

  publicUrl(formId: string): string {
    return `${globalThis.location?.origin ?? ''}/public/${formId}`;
  }

  async copyLink(formId: string): Promise<void> {
    try {
      const url = this.publicUrl(formId);
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const input = document.createElement('textarea');
        input.value = url;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('Clipboard unavailable.');
      }
      this.copiedFormId.set(formId);
    } catch {
      this.error.set('Could not copy the link. Select and copy it from the address bar.');
    }
  }
}
