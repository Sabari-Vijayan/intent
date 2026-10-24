import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SchemaFormRendererComponent } from '../../../shared/forms/schema-form-renderer/schema-form-renderer.component';
import { AIProposeEditResult, Field, FieldType, FormSchema } from '../../../types/schema';
import { validFormSchema } from '../../../types/schema.fixtures';
import { validateFormSchema } from '../../../types/schema.validator';
import { applyFormEditOperations, describeFormEditOperations } from '../../../types/schema.edits';
import { translationKeys, validateTranslationStrings } from '../../../types/schema.translation';
import { SupabaseDataService } from '../../../core/supabase/supabase-data.service';

const FIELD_TYPES: FieldType[] = [
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

@Component({
  selector: 'app-form-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SchemaFormRendererComponent],
  template: `
    <div class="container editor-page">
      <div class="page-header">
        <div>
               <a routerLink="/forms" class="back-link">← My forms</a>
               <h1>Edit form</h1>
               @if (formId) {
                 <div class="form-status" role="status">
                   <span [class]="published() ? 'status-dot published-dot' : 'status-dot draft-dot'" aria-hidden="true"></span>
                   {{ published() ? 'Published' : 'Draft' }}
                   @if (versionNumber()) { <span>· Version {{ versionNumber() }}</span> }
                 </div>
               }
        </div>
         <div class="actions">
           @if (formId && published()) {
             <a class="live-link" [href]="publicUrl()" target="_blank" rel="noopener">Open live form ↗</a>
             <button class="btn btn-secondary" type="button" (click)="copyPublicLink()">
               {{ copied() ? 'Link copied' : 'Copy link' }}
             </button>
           }
           <button class="btn btn-secondary" type="button" (click)="preview.set(!preview())">
            {{ preview() ? 'Edit form' : 'Preview' }}</button
           ><button class="btn btn-secondary" type="button" (click)="saveDraft()" [disabled]="loading()">Save draft</button
           ><button class="btn btn-primary" type="button" (click)="publish()" [disabled]="loading()">Publish</button>
        </div>
      </div>

      @if (!formId) {
        <section class="card ai-generator" aria-labelledby="ai-generator-heading">
          <div class="card-body">
            <div>
              <span class="eyebrow">AI draft</span>
              <h2 id="ai-generator-heading">Start with a sentence</h2>
              <p class="help-text">Describe the form you need. Intent will prepare a draft for your review.</p>
            </div>
            <label class="label" for="generation-prompt">What should this form collect?</label>
            <textarea
              id="generation-prompt"
              class="input"
              rows="3"
              [(ngModel)]="generationPrompt"
              placeholder="A customer satisfaction survey for our new product"
            ></textarea>
            <div class="ai-actions">
              <button class="btn btn-primary" type="button" (click)="generateForm()" [disabled]="generating()">
                 @if (generating()) { <span class="button-spark" aria-hidden="true">✦</span> }
                 {{ generating() ? 'Shaping your form…' : 'Draft with AI' }}
              </button>
              <span class="help-text">The draft is never saved or published until you accept it.</span>
            </div>
          </div>
        </section>
      }

       @if (proposal()) {
        <section class="card proposal-card" aria-labelledby="proposal-heading">
          <div class="card-header">
            <div>
              <span class="eyebrow">Review required</span>
              <h2 id="proposal-heading">AI draft proposal</h2>
            </div>
            <button class="btn btn-secondary" type="button" (click)="proposal.set(null)">Discard</button>
          </div>
          <div class="card-body">
            <p>{{ proposal()?.explanation }}</p>
            @if (proposal()?.validation_findings?.length) {
              <ul class="findings" aria-label="AI validation findings">
                @for (finding of proposal()?.validation_findings; track finding) { <li>{{ finding }}</li> }
              </ul>
            }
            <div class="proposal-preview"><app-schema-form-renderer [schema]="proposal()!.schema" [showSubmit]="false" /></div>
            <button class="btn btn-primary" type="button" (click)="acceptProposal()">Use this draft</button>
          </div>
        </section>
      }

       @if (savingAction()) {
         <div class="save-state" role="status">
           <span class="save-orbit" aria-hidden="true"><i></i><i></i><i></i></span>
           {{ savingAction() === 'publishing' ? 'Putting your form on the shelf…' : 'Saving your changes…' }}
         </div>
       }

       @if (formId) {
         <section class="card ai-editor" aria-labelledby="ai-edit-heading">
           <div class="card-body">
             <span class="eyebrow">AI refine</span>
             <h2 id="ai-edit-heading">Describe a change</h2>
             <p class="help-text">Intent proposes typed changes for your review. It never edits or saves this form automatically.</p>
             <label class="label" for="edit-instruction">What should change?</label>
             <textarea id="edit-instruction" class="input" rows="2" [(ngModel)]="editInstruction" placeholder="Make the first question required and add a question about preferred contact time"></textarea>
             <div class="ai-actions">
               <button class="btn btn-primary" type="button" (click)="proposeEdit()" [disabled]="editing()">{{ editing() ? 'Thinking…' : 'Suggest changes' }}</button>
               @if (revisionStack().length) { <button class="btn btn-secondary" type="button" (click)="undoEdit()">Undo last AI change</button> }
             </div>
           </div>
         </section>
       }
        @if (editProposal()) {
         <section class="card proposal-card" aria-labelledby="edit-proposal-heading">
           <div class="card-header"><div><span class="eyebrow">Review required</span><h2 id="edit-proposal-heading">AI edit proposal</h2></div><button class="btn btn-secondary" type="button" (click)="editProposal.set(null)">Discard</button></div>
           <div class="card-body">
             <p>{{ editProposal()?.explanation }}</p>
             <ul class="findings" aria-label="Proposed changes">
               @for (change of proposedChanges(); track change) { <li>{{ change }}</li> }
             </ul>
             <button class="btn btn-primary" type="button" (click)="acceptEditProposal()">Apply these changes</button>
           </div>
         </section>
        }
        @if (formId) {
          <section class="card translation-editor" aria-labelledby="translation-heading">
            <div class="card-body">
              <span class="eyebrow">Languages</span>
              <h2 id="translation-heading">Prepare translations</h2>
              <p class="help-text">Add languages, then translate the finalized draft before publishing.</p>
              <div class="translation-add">
                <label class="sr-only" for="new-locale">Language code</label>
                <input id="new-locale" class="input" [(ngModel)]="newLocale" placeholder="e.g. ml or hi" />
                <button class="btn btn-secondary" type="button" (click)="addLocale()">Add language</button>
              </div>
              <div class="translation-list">
                @for (locale of schema().enabled_locales; track locale) {
                  <div class="translation-row">
                    <strong>{{ locale }}</strong>
                    @if (locale === schema().default_locale) { <span class="help-text">Source language</span> }
                    @else {
                      <span class="help-text">{{ translationStatuses()[locale] || 'Not translated' }}</span>
                      <button class="btn btn-ghost btn-sm" type="button" (click)="translateLocale(locale)" [disabled]="translating()">{{ translatingLocale() === locale ? 'Translating…' : 'Translate' }}</button>
                      @if (translationDrafts()[locale]) { <button class="btn btn-ghost btn-sm" type="button" (click)="reviewLocale.set(locale)">Review</button> }
                      <button class="btn btn-ghost btn-sm" type="button" (click)="removeLocale(locale)" [disabled]="translating()">Remove</button>
                    }
                  </div>
                }
              </div>
              @if (reviewLocale()) {
                <div class="translation-review" aria-labelledby="translation-review-heading">
                  <h3 id="translation-review-heading">Review {{ reviewLocale() }}</h3>
                  @for (key of translationKeysForReview(); track key) {
                    <label class="label" [for]="'translation-' + key">{{ translationLabel(key) }}</label>
                    <input class="input" [id]="'translation-' + key" [ngModel]="(translationDrafts()[reviewLocale()] || {})[key] || ''" (ngModelChange)="updateTranslationString(reviewLocale()!, key, $event)" />
                  }
                  <div class="translation-review-actions">
                    <button class="btn btn-primary" type="button" (click)="saveTranslationReview()" [disabled]="translationSaving()">{{ translationSaving() ? 'Saving…' : 'Save review' }}</button>
                    <button class="btn btn-secondary" type="button" (click)="reviewLocale.set('')">Close</button>
                  </div>
                </div>
              }
            </div>
          </section>
        }
        @if (notice()) {
        <div class="notice" role="status">{{ notice() }}</div>
      }
      @if (preview()) {
        <div class="card preview-card">
          <div class="card-body">
            <div class="preview-label">Respondent preview</div>
            <app-schema-form-renderer [schema]="schema()" />
          </div>
        </div>
      } @else {
        <div class="editor-grid">
          <section class="card" aria-labelledby="editor-heading">
            <div class="card-header"><h2 id="editor-heading">Form structure</h2></div>
            <div class="card-body">
              <div class="form-group">
                <label class="label" for="form-title">Title</label
                ><input
                  id="form-title"
                  class="input"
                  [(ngModel)]="schema().title"
                  (ngModelChange)="updateSchema()"
                />
              </div>
              <div class="form-group">
                <label class="label" for="form-description">Description</label
                ><textarea
                  id="form-description"
                  class="input"
                  rows="2"
                  [(ngModel)]="schema().description"
                  (ngModelChange)="updateSchema()"
                ></textarea>
              </div>
              @for (section of schema().sections; track section.id; let sectionIndex = $index) {
                <div class="section-editor">
                  <div class="section-heading">
                    <input
                      class="input"
                      [attr.aria-label]="'Section ' + (sectionIndex + 1) + ' title'"
                      [(ngModel)]="section.title"
                      (ngModelChange)="updateSchema()"
                    /><button
                      class="btn btn-ghost btn-sm"
                      type="button"
                      (click)="removeSection(sectionIndex)"
                    >
                      Remove section
                    </button>
                  </div>
                  @for (field of section.fields; track field.id; let fieldIndex = $index) {
                     <article class="field-editor" draggable="true" (dragstart)="startDragging(sectionIndex, fieldIndex, $event)" (dragover)="allowDrop($event)" (drop)="dropField(sectionIndex, fieldIndex, $event)" (dragend)="draggingField.set(null)" [class.dragging]="draggingField()?.sectionIndex === sectionIndex && draggingField()?.fieldIndex === fieldIndex">
                       <div class="field-toolbar">
                         <strong><span class="drag-handle" aria-hidden="true">⠿</span>{{ field.type }}</strong>
                        <div>
                          <button
                            class="btn btn-ghost btn-sm"
                            type="button"
                            [disabled]="fieldIndex === 0"
                            (click)="moveField(sectionIndex, fieldIndex, -1)"
                            aria-label="Move field up"
                          >
                            ↑</button
                          ><button
                            class="btn btn-ghost btn-sm"
                            type="button"
                            [disabled]="fieldIndex === section.fields.length - 1"
                            (click)="moveField(sectionIndex, fieldIndex, 1)"
                            aria-label="Move field down"
                          >
                            ↓</button
                          ><button
                            class="btn btn-ghost btn-sm"
                            type="button"
                            (click)="removeField(sectionIndex, fieldIndex)"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <label class="label" [for]="field.id + '-label'">Question label</label
                      ><input
                        class="input"
                        [id]="field.id + '-label'"
                        [(ngModel)]="field.label"
                        (ngModelChange)="updateSchema()"
                      />
                      <div class="field-options">
                        <label class="label" [for]="field.id + '-type'">Type</label
                        ><select
                          class="input"
                          [id]="field.id + '-type'"
                          [(ngModel)]="field.type"
                          (ngModelChange)="updateSchema()"
                        >
                          @for (type of fieldTypes; track type) {
                            <option [value]="type">{{ type }}</option>
                          }</select
                        ><label class="choice-label"
                          ><input
                            type="checkbox"
                            [(ngModel)]="field.required"
                            (ngModelChange)="updateSchema()"
                          />
                          Required</label
                       >
                      </div>
                      @if (field.type === 'single_choice' || field.type === 'multiple_choice') {
                        <div class="options-editor" [attr.aria-label]="field.label + ' options'">
                          <div class="options-heading">
                            <span class="label">Options</span>
                            <button class="btn btn-ghost btn-sm" type="button" (click)="addOption(sectionIndex, fieldIndex)">+ Add option</button>
                          </div>
                          @for (option of field.options ?? []; track option.id; let optionIndex = $index) {
                            <div class="option-row">
                              <input class="input" [id]="option.id + '-label'" [attr.aria-label]="'Option ' + (optionIndex + 1) + ' label'" [(ngModel)]="option.label" (ngModelChange)="updateSchema()" />
                              <button class="btn btn-ghost btn-sm" type="button" [disabled]="(field.options?.length ?? 0) <= 2" (click)="removeOption(sectionIndex, fieldIndex, optionIndex)" [attr.aria-label]="'Remove option ' + (optionIndex + 1)">Remove</button>
                            </div>
                          }
                        </div>
                      }
                    </article>
                  }
                  <button
                    class="btn btn-secondary add-button"
                    type="button"
                    (click)="addField(sectionIndex)"
                  >
                    + Add question
                  </button>
                </div>
              }
              <button class="btn btn-secondary" type="button" (click)="addSection()">
                + Add section
              </button>
            </div>
          </section>
          <aside class="card mini-preview">
            <div class="card-header"><h2>Live preview</h2></div>
            <div class="card-body">
              <app-schema-form-renderer [schema]="schema()" [showSubmit]="false" />
            </div>
          </aside>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .page-header {
        align-items: flex-end;
      }
      .editor-page { max-width: 1120px; }
      .editor-page > .page-header { margin-bottom: 32px; }
      .editor-grid { align-items: start; }
      .editor-grid > section {
        border-top: 3px solid #252522;
        border-radius: 3px 3px 18px 18px;
      }
      .editor-grid > section .card-header {
        background: #f1f3ed;
        border-bottom-color: #dfe2d9;
      }
      .editor-grid > section .card-header h2,
      .mini-preview .card-header h2 { font-size: 1.55rem; }
      .mini-preview {
        border: 0;
        background: transparent;
        box-shadow: none;
      }
      .mini-preview .card-header { padding-inline: 0; border-bottom: 1px solid #dfe2d9; }
      .mini-preview .card-body { padding: 24px 0 0; }
      .back-link {
        display: block;
        margin-bottom: var(--space-2);
        font-size: var(--text-sm);
      }
      .actions,
      .section-heading,
      .field-toolbar,
      .field-options {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .actions {
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .actions .btn {
        min-height: 40px;
      }
      .live-link {
        align-self: center;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        white-space: nowrap;
      }
      .live-link:hover { color: var(--color-primary-text); text-decoration: none; }
      .notice {
        background: var(--color-success-subtle);
        color: var(--color-success);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        margin-bottom: var(--space-4);
      }
      .ai-generator,
      .ai-editor,
      .proposal-card {
        margin-bottom: var(--space-6);
      }
      .ai-generator {
        background: #eef3ed;
        border-color: #dfe9de;
        box-shadow: none;
      }
      .ai-generator h2,
      .proposal-card h2 {
        margin: var(--space-1) 0 var(--space-2);
      }
      .ai-actions {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-top: var(--space-3);
      }
      .proposal-preview {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        margin: var(--space-4) 0;
        padding: var(--space-4);
      }
      .findings {
        color: var(--color-text-secondary);
        padding-left: var(--space-5);
      }
      .editor-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
        gap: var(--space-6);
        align-items: start;
      }
      .section-editor {
        border-top: 1px solid var(--color-border);
        padding-top: var(--space-4);
        margin-top: var(--space-5);
      }
      .section-heading {
        margin-bottom: var(--space-3);
      }
      .section-heading .input {
        flex: 1;
        font-weight: var(--font-semibold);
      }
      .field-editor {
        border: 1px solid #e6e6e0;
        border-radius: 14px;
        padding: 18px;
        margin-bottom: var(--space-3);
        background: #fcfcfa;
      }
      .field-editor.dragging { opacity: .45; }
      .field-toolbar {
        justify-content: space-between;
        margin-bottom: var(--space-3);
        color: var(--color-text-secondary);
        text-transform: capitalize;
      }
      .field-options {
        margin-top: var(--space-3);
        flex-wrap: wrap;
      }
      .field-options .label {
        margin: 0;
      }
      .field-options select {
        min-width: 160px;
      }
      .form-status { display: flex; align-items: center; gap: 7px; color: var(--color-text-muted); font-size: var(--text-sm); }
      .status-dot { width: 7px; height: 7px; border-radius: 50%; }
      .published-dot { background: var(--color-success); }
      .draft-dot { background: var(--color-warning); }
      .options-editor { margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid #e6e6e0; }
      .options-heading, .option-row { display: flex; align-items: center; gap: var(--space-2); }
      .options-heading { justify-content: space-between; margin-bottom: var(--space-2); }
      .options-heading .label { margin: 0; }
      .option-row { margin-bottom: var(--space-2); }
      .option-row .input { flex: 1; }
      .add-button {
        margin-bottom: var(--space-4);
      }
      .preview-label {
        color: var(--color-text-muted);
        font-size: var(--text-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--space-4);
      }
      .mini-preview {
        position: sticky;
        top: 104px;
      }
      @media (max-width: 900px) {
        .editor-grid {
          grid-template-columns: 1fr;
        }
        .mini-preview {
          display: none;
        }
        .page-header {
          align-items: flex-start;
        }
      }
      @media (max-width: 560px) {
        .page-header {
          align-items: stretch;
        }
        .actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--space-2);
        }
        .actions .btn {
          width: 100%;
        }
        .actions .btn:last-child {
          grid-column: 1 / -1;
        }
        .section-heading,
        .field-toolbar {
          align-items: stretch;
          flex-direction: column;
        }
        .section-heading .btn,
        .field-toolbar > div {
          width: 100%;
        }
        .field-toolbar > div {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .field-toolbar > div .btn {
          min-width: 0;
          padding-inline: var(--space-2);
        }
        .field-options {
          display: grid;
          grid-template-columns: 1fr;
          align-items: stretch;
        }
        .field-options select {
          min-width: 0;
        }
        .field-options .choice-label {
          padding-top: var(--space-2);
        }
      }
    `,
  ],
})
export class FormEditorComponent {
  private readonly data = inject(SupabaseDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  schema = signal<FormSchema>(structuredClone(validFormSchema));
  preview = signal(false);
  notice = signal('');
  fieldTypes = FIELD_TYPES;
  private nextId = 1;
  formId: string | null = null;
  loading = signal(false);
  generating = signal(false);
  savingAction = signal<'saving' | 'publishing' | null>(null);
  proposal = signal<import('../../../types/schema').AIGenerateFormResult | null>(null);
  editProposal = signal<AIProposeEditResult | null>(null);
  revisionStack = signal<FormSchema[]>([]);
  translationStatuses = signal<Record<string, string>>({});
  translationDrafts = signal<Record<string, Record<string, string>>>({});
  reviewLocale = signal('');
  draggingField = signal<{ sectionIndex: number; fieldIndex: number } | null>(null);
  generationPrompt = '';
  editInstruction = '';
  newLocale = '';
  published = signal(false);
  versionNumber = signal<number | null>(null);
  copied = signal(false);
  editing = signal(false);
  translating = signal(false);
  translatingLocale = signal('');
  translationSaving = signal(false);
  private versionId: string | null = null;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.formId = id;
      void this.loadForm(id);
    }
  }

  private async loadForm(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.data.formWithCurrentVersion(id);
       this.published.set(result.form.status === 'published');
        if (result.version) {
          this.versionId = result.version.id;
         this.versionNumber.set(result.version.version_number);
          this.schema.set(structuredClone(result.version.schema_json));
          const translations = await this.data.formTranslations(result.version.id);
          this.translationStatuses.set(Object.fromEntries(translations.map((translation) => [translation.locale, translation.status === 'complete' ? 'Ready' : translation.status])));
          this.translationDrafts.set(Object.fromEntries(translations.map((translation) => [translation.locale, { ...translation.strings }])));
       }
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Could not load this form.');
    } finally {
      this.loading.set(false);
      this.savingAction.set(null);
    }
  }

  addLocale(): void {
    const locale = this.newLocale.trim();
    if (!/^[a-z]{2,3}(?:-[A-Z][a-z]{2})?$/.test(locale)) {
      this.notice.set('Use a locale such as ml, hi, or en-US.');
      return;
    }
    if (this.schema().enabled_locales.includes(locale)) {
      this.notice.set('That language is already enabled.');
      return;
    }
    this.schema.set({ ...this.schema(), enabled_locales: [...this.schema().enabled_locales, locale] });
    this.newLocale = '';
  }

  translationKeysForReview(): string[] {
    return translationKeys(this.schema());
  }

  translationLabel(key: string): string {
    return key.replace(/^form\./, 'Form ').replace(/^section\./, 'Section ').replace(/^field\./, 'Question ').replace(/^option\./, 'Option ').replaceAll('.', ' · ');
  }

  updateTranslationString(locale: string, key: string, value: string): void {
    this.translationDrafts.update((drafts) => ({
      ...drafts,
      [locale]: { ...(drafts[locale] ?? {}), [key]: value },
    }));
  }

  async saveTranslationReview(): Promise<void> {
    const locale = this.reviewLocale();
    if (!locale || !this.formId) return;
    const strings = this.translationDrafts()[locale] ?? {};
    const validation = validateTranslationStrings(this.schema(), strings);
    if (!validation.valid && !validation.error.startsWith('Missing translation key:')) {
      this.notice.set(validation.error);
      return;
    }
    this.translationSaving.set(true);
    try {
      const version = await this.data.saveDraft(this.formId, this.schema());
      this.versionId = version.id;
      this.versionNumber.set(version.version_number);
      const status = validation.valid ? 'complete' : 'partial';
      await this.data.saveFormTranslation(version.id, locale, strings, status);
      this.translationStatuses.update((statuses) => ({ ...statuses, [locale]: validation.valid ? 'Ready' : 'Partial — source fallback used' }));
      this.notice.set(validation.valid ? `${locale} translation review saved.` : `${locale} review saved as partial.`);
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Could not save the translation review.');
    } finally {
      this.translationSaving.set(false);
    }
  }

  removeLocale(locale: string): void {
    this.schema.set({ ...this.schema(), enabled_locales: this.schema().enabled_locales.filter((item) => item !== locale) });
  }

  async translateLocale(locale: string): Promise<void> {
    if (!this.formId || locale === this.schema().default_locale) return;
    this.translating.set(true);
    this.translatingLocale.set(locale);
    this.notice.set('');
    try {
      const previousVersionId = this.versionId;
      const version = await this.data.saveDraft(this.formId, this.schema());
      this.versionId = version.id;
      this.versionNumber.set(version.version_number);
      if (previousVersionId && previousVersionId !== version.id) this.translationStatuses.set({});
      const result = await this.data.translateForm(this.schema(), this.schema().default_locale, locale);
      const validation = validateTranslationStrings(this.schema(), result.strings);
      if (!validation.valid && !validation.error.startsWith('Missing translation key:')) throw new Error(validation.error);
      const status = result.completeness < 1 || result.missing_keys?.length ? 'partial' : 'complete';
      await this.data.saveFormTranslation(version.id, locale, result.strings, status, result.provider, result.model);
      this.translationDrafts.update((drafts) => ({ ...drafts, [locale]: { ...result.strings } }));
      this.translationStatuses.update((statuses) => ({ ...statuses, [locale]: status === 'complete' ? 'Ready' : 'Partial — source fallback used' }));
      this.notice.set(status === 'complete' ? `${locale} translation is ready for review and publishing.` : `${locale} translation is partial; missing text will use the source language.`);
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Could not translate this form.');
    } finally {
      this.translating.set(false);
      this.translatingLocale.set('');
    }
  }

  updateSchema(): void {
    this.schema.set({ ...this.schema() });
  }

  async generateForm(): Promise<void> {
    if (this.generationPrompt.trim().length < 10) {
      this.notice.set('Describe the form in at least 10 characters.');
      return;
    }
    this.generating.set(true);
    this.notice.set('');
    try {
      this.proposal.set(await this.data.generateForm(this.generationPrompt));
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Could not generate a form draft.');
    } finally {
      this.generating.set(false);
    }
  }

  acceptProposal(): void {
    const proposal = this.proposal();
    if (!proposal) return;
    const validation = validateFormSchema(proposal.schema);
    if (!validation.valid) {
      this.notice.set(`Cannot accept proposal: ${validation.errors[0].path} ${validation.errors[0].message}`);
      return;
    }
    this.schema.set(structuredClone(proposal.schema));
    this.proposal.set(null);
    this.notice.set('AI draft accepted for editing. Review it before saving.');
  }

  async proposeEdit(): Promise<void> {
    if (this.editInstruction.trim().length < 3) {
      this.notice.set('Describe the change in at least 3 characters.');
      return;
    }
    this.editing.set(true);
    this.notice.set('');
    try {
      this.editProposal.set(await this.data.proposeFormEdit(this.schema(), this.editInstruction.trim()));
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Could not propose an edit.');
    } finally {
      this.editing.set(false);
    }
  }

  proposedChanges(): string[] {
    return this.editProposal() ? describeFormEditOperations(this.editProposal()!.ops) : [];
  }

  acceptEditProposal(): void {
    const proposal = this.editProposal();
    if (!proposal) return;
    try {
      const next = applyFormEditOperations(this.schema(), proposal.ops);
      this.revisionStack.update((revisions) => [...revisions, structuredClone(this.schema())]);
      this.schema.set(next);
      this.editProposal.set(null);
      this.editInstruction = '';
      this.notice.set('AI changes applied for review. Save when you are ready.');
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'The proposed edit was invalid.');
    }
  }

  undoEdit(): void {
    const revisions = this.revisionStack();
    const previous = revisions.at(-1);
    if (!previous) return;
    this.schema.set(structuredClone(previous));
    this.revisionStack.set(revisions.slice(0, -1));
    this.notice.set('The last AI change was undone.');
  }

  addSection(): void {
    const next = {
      ...this.schema(),
      sections: [
        ...this.schema().sections,
        { id: `sec_new_${this.nextId++}`, title: 'New section', fields: [] },
      ],
    };
    this.schema.set(next);
  }

  removeSection(index: number): void {
    this.schema.set({
      ...this.schema(),
      sections: this.schema().sections.filter((_, current) => current !== index),
    });
  }

  addField(sectionIndex: number): void {
    const field: Field = {
      id: `fld_new_${this.nextId++}`,
      type: 'short_text',
      label: 'New question',
      required: false,
    };
    const sections = this.schema().sections.map((section, index) =>
      index === sectionIndex ? { ...section, fields: [...section.fields, field] } : section
    );
    this.schema.set({ ...this.schema(), sections });
  }

  removeField(sectionIndex: number, fieldIndex: number): void {
    const sections = this.schema().sections.map((section, index) =>
      index === sectionIndex
        ? { ...section, fields: section.fields.filter((_, current) => current !== fieldIndex) }
        : section
    );
    this.schema.set({ ...this.schema(), sections });
  }

  addOption(sectionIndex: number, fieldIndex: number): void {
    const sections = this.schema().sections.map((section, currentSection) => {
      if (currentSection !== sectionIndex) return section;
      return {
        ...section,
        fields: section.fields.map((field, currentField) => {
          if (currentField !== fieldIndex) return field;
          const options = field.options ?? [];
          return { ...field, options: [...options, { id: `opt_new_${this.nextId++}`, label: 'New option' }] };
        }),
      };
    });
    this.schema.set({ ...this.schema(), sections });
  }

  removeOption(sectionIndex: number, fieldIndex: number, optionIndex: number): void {
    const sections = this.schema().sections.map((section, currentSection) => {
      if (currentSection !== sectionIndex) return section;
      return {
        ...section,
        fields: section.fields.map((field, currentField) => {
          if (currentField !== fieldIndex || !field.options || field.options.length <= 2) return field;
          return { ...field, options: field.options.filter((_, index) => index !== optionIndex) };
        }),
      };
    });
    this.schema.set({ ...this.schema(), sections });
  }

  moveField(sectionIndex: number, fieldIndex: number, direction: -1 | 1): void {
    const sections = this.schema().sections.map((section, index) => {
      if (index !== sectionIndex) return section;
      const fields = [...section.fields];
      [fields[fieldIndex], fields[fieldIndex + direction]] = [
        fields[fieldIndex + direction],
        fields[fieldIndex],
      ];
      return { ...section, fields };
    });
    this.schema.set({ ...this.schema(), sections });
  }

  startDragging(sectionIndex: number, fieldIndex: number, event: DragEvent): void {
    this.draggingField.set({ sectionIndex, fieldIndex });
    event.dataTransfer?.setData('text/plain', `${sectionIndex}:${fieldIndex}`);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  dropField(sectionIndex: number, targetIndex: number, event: DragEvent): void {
    event.preventDefault();
    const source = this.draggingField();
    this.draggingField.set(null);
    if (!source || source.sectionIndex !== sectionIndex || source.fieldIndex === targetIndex) return;
    const sections = structuredClone(this.schema().sections);
    const fields = sections[sectionIndex].fields;
    const [moved] = fields.splice(source.fieldIndex, 1);
    fields.splice(targetIndex > source.fieldIndex ? targetIndex - 1 : targetIndex, 0, moved);
    this.schema.set({ ...this.schema(), sections });
  }

  async saveDraft(): Promise<void> {
    await this.persist(false);
  }

  async publish(): Promise<void> {
    await this.persist(true);
  }

  publicUrl(): string {
    return this.formId ? `${globalThis.location?.origin ?? ''}/public/${this.formId}` : '';
  }

  async copyPublicLink(): Promise<void> {
    const url = this.publicUrl();
    if (!url) return;
    try {
      await this.writeClipboard(url);
      this.copied.set(true);
    } catch {
      this.notice.set('Could not copy the link. Select and copy it from the address bar.');
    }
  }

  private async writeClipboard(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', 'true');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('Clipboard unavailable.');
  }

  private async persist(publish: boolean): Promise<void> {
    const validation = validateFormSchema(this.schema());
    if (!validation.valid) {
      this.notice.set(`Cannot save: ${validation.errors[0].path} ${validation.errors[0].message}`);
      return;
    }
    this.loading.set(true);
    this.savingAction.set(publish ? 'publishing' : 'saving');
    try {
      if (!this.formId) {
        const workspace = await this.data.workspaceForCurrentUser();
        if (!workspace) throw new Error('Please sign in before saving a form.');
        const slug =
          this.schema()
            .title.toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '') || `form-${Date.now()}`;
        const version = await this.data.createForm(workspace.id, this.schema(), slug);
        this.formId = version.form_id;
        this.versionId = version.id;
      }
      const previousVersionId = this.versionId;
      if (publish) {
        const version = await this.data.publishDraft(this.formId, this.schema());
        this.versionId = version.id;
        this.versionNumber.set(version.version_number);
      } else {
        const version = await this.data.saveDraft(this.formId, this.schema());
        this.versionId = version.id;
        this.versionNumber.set(version.version_number);
      }
      if (previousVersionId && previousVersionId !== this.versionId) this.translationStatuses.set({});
      this.published.set(publish);
      this.notice.set(publish ? 'Form published successfully.' : 'Draft saved successfully.');
      if (this.route.snapshot.paramMap.get('id') === 'new')
        await this.router.navigate(['/forms', this.formId]);
    } catch (error) {
      this.notice.set(error instanceof Error ? error.message : 'Could not save the form.');
    } finally {
      this.loading.set(false);
      this.savingAction.set(null);
    }
  }
}
