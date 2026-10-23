import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Field, FormSchema } from '../../../types/schema';

@Component({
  selector: 'app-schema-form-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form (ngSubmit)="submit()" novalidate>
      <div class="form-intro">
        <h2>{{ schema.title }}</h2>
        @if (schema.description) {
          <p>{{ schema.description }}</p>
        }
      </div>

      @for (section of schema.sections; track section.id) {
        <fieldset
          class="section"
          [attr.aria-describedby]="section.description ? section.id + '-description' : null"
        >
          <legend>{{ section.title }}</legend>
          @if (section.description) {
            <p class="help-text" [id]="section.id + '-description'">{{ section.description }}</p>
          }

          @for (field of section.fields; track field.id) {
            @if (isVisible(field)) {
              <div class="form-group">
                @if (
                  field.type !== 'consent' &&
                  field.type !== 'single_choice' &&
                  field.type !== 'multiple_choice' &&
                  field.type !== 'rating'
                ) {
                  <label class="label" [for]="field.id"
                    >{{ field.label }}
                    @if (field.required) {
                      <span aria-hidden="true">*</span>
                    }
                  </label>
                }
                @if (field.help_text) {
                  <div class="help-text" [id]="field.id + '-help'">{{ field.help_text }}</div>
                }

                @switch (field.type) {
                  @case ('short_text') {
                    <input
                      class="input"
                      [id]="field.id"
                      type="text"
                      [required]="!!field.required"
                      [attr.aria-describedby]="field.help_text ? field.id + '-help' : null"
                      [(ngModel)]="answers[field.id]"
                      [name]="field.id"
                    />
                  }
                  @case ('long_text') {
                    <textarea
                      class="input"
                      [id]="field.id"
                      rows="4"
                      [required]="!!field.required"
                      [attr.aria-describedby]="field.help_text ? field.id + '-help' : null"
                      [(ngModel)]="answers[field.id]"
                      [name]="field.id"
                    ></textarea>
                  }
                  @case ('email') {
                    <input
                      class="input"
                      [id]="field.id"
                      type="email"
                      [required]="!!field.required"
                      [(ngModel)]="answers[field.id]"
                      [name]="field.id"
                    />
                  }
                  @case ('number') {
                    <input
                      class="input"
                      [id]="field.id"
                      type="number"
                      [required]="!!field.required"
                      [min]="field.validation?.min ?? null"
                      [max]="field.validation?.max ?? null"
                      [(ngModel)]="answers[field.id]"
                      [name]="field.id"
                    />
                  }
                  @case ('date') {
                    <input
                      class="input"
                      [id]="field.id"
                      type="date"
                      [required]="!!field.required"
                      [(ngModel)]="answers[field.id]"
                      [name]="field.id"
                    />
                  }
                  @case ('consent') {
                    <label class="choice-label"
                      ><input
                        type="checkbox"
                        [id]="field.id"
                        [required]="!!field.required"
                        [(ngModel)]="answers[field.id]"
                        [name]="field.id"
                      />
                      {{ field.label }}
                      @if (field.required) {
                        <span aria-hidden="true">*</span>
                      }
                    </label>
                  }
                  @case ('single_choice') {
                    <div class="choice-group" role="radiogroup" [attr.aria-label]="field.label">
                      @for (option of field.options ?? []; track option.id) {
                        <label class="choice-label"
                          ><input
                            type="radio"
                            [name]="field.id"
                            [value]="option.id"
                            [(ngModel)]="answers[field.id]"
                          />
                          {{ option.label }}</label
                        >
                      }
                    </div>
                  }
                  @case ('multiple_choice') {
                    <div class="choice-group" [attr.aria-label]="field.label">
                      @for (option of field.options ?? []; track option.id) {
                        <label class="choice-label"
                          ><input
                            type="checkbox"
                            [checked]="hasOption(field.id, option.id)"
                            (change)="toggleOption(field.id, option.id)"
                          />
                          {{ option.label }}</label
                        >
                      }
                    </div>
                  }
                  @case ('rating') {
                    <div class="choice-group" role="radiogroup" [attr.aria-label]="field.label">
                      @for (rating of ratingOptions(field); track rating) {
                        <label class="choice-label"
                          ><input
                            type="radio"
                            [name]="field.id"
                            [value]="rating"
                            [(ngModel)]="answers[field.id]"
                          />
                          {{ rating }}</label
                        >
                      }
                    </div>
                  }
                }
                @if (submittedState && field.required && isEmpty(answers[field.id])) {
                  <div class="error-text" role="alert">This field is required.</div>
                }
              </div>
            }
          }
        </fieldset>
      }
      @if (showSubmit) {
        <button class="btn btn-primary" type="submit" [disabled]="submitting">
          Submit response
        </button>
        @if (submittedState && valid) {
          <p class="success-text" role="status">Response is valid and ready to submit.</p>
        }
      }
    </form>
  `,
  styles: [
    `
      .form-intro {
        margin-bottom: var(--space-6);
      }
      .form-intro p {
        color: var(--color-text-secondary);
      }
      .section {
        border: 0;
        border-top: 1px solid var(--color-border);
        padding: var(--space-6) 0 0;
        margin: 0 0 var(--space-6);
      }
      legend {
        font-size: var(--text-xl);
        font-weight: var(--font-semibold);
        padding: 0;
      }
      .choice-group {
        display: grid;
        gap: var(--space-2);
        margin-top: var(--space-2);
      }
      .choice-label {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 32px;
      }
      .choice-label input {
        accent-color: var(--color-primary);
      }
      .success-text {
        color: var(--color-success);
        margin-top: var(--space-3);
      }
      @media (max-width: 640px) {
        .form-intro h2 {
          font-size: 1.55rem;
        }
        .section {
          padding-top: var(--space-5);
          margin-bottom: var(--space-5);
        }
        legend {
          font-size: var(--text-lg);
        }
        .choice-group {
          gap: var(--space-2);
        }
        .choice-label {
          min-height: 44px;
          align-items: flex-start;
          padding: 10px 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          line-height: 1.35;
        }
        .choice-label input {
          flex: 0 0 auto;
          margin-top: 2px;
        }
        form > .btn {
          width: 100%;
          min-height: 46px;
        }
      }
    `,
  ],
})
export class SchemaFormRendererComponent {
  @Input({ required: true }) schema!: FormSchema;
  @Input() showSubmit = true;
  @Input() submitting = false;
  @Output() submitted = new EventEmitter<Record<string, unknown>>();

  answers: Record<string, unknown> = {};
  submittedState = false;
  valid = false;

  submit(): void {
    this.submittedState = true;
    this.valid = this.schema.sections.every((section) =>
      section.fields.every(
        (field) =>
          !this.isVisible(field) || !field.required || !this.isEmpty(this.answers[field.id])
      )
    );
    if (this.valid) this.submitted.emit({ ...this.answers });
  }

  isVisible(field: Field): boolean {
    if (!field.condition) return true;
    const answer = this.answers[field.condition.field_id];
    const expected = field.condition.value;
    switch (field.condition.operator) {
      case 'equals':
        return answer === expected;
      case 'not_equals':
        return answer !== expected;
      case 'is_empty':
        return this.isEmpty(answer);
      case 'is_not_empty':
        return !this.isEmpty(answer);
      case 'contains':
        return Array.isArray(answer)
          ? answer.includes(expected)
          : String(answer ?? '').includes(String(expected));
      case 'not_contains':
        return !this.isVisible({
          ...field,
          condition: { ...field.condition, operator: 'contains' },
        });
      case 'greater_than':
        return Number(answer) > Number(expected);
      case 'less_than':
        return Number(answer) < Number(expected);
      case 'greater_than_or_equal':
        return Number(answer) >= Number(expected);
      case 'less_than_or_equal':
        return Number(answer) <= Number(expected);
    }
  }

  ratingOptions(field: Field): number[] {
    const min = field.validation?.min ?? 1;
    const max = field.validation?.max ?? 5;
    return Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => min + index);
  }

  hasOption(fieldId: string, optionId: string): boolean {
    return (
      Array.isArray(this.answers[fieldId]) &&
      (this.answers[fieldId] as unknown[]).includes(optionId)
    );
  }

  toggleOption(fieldId: string, optionId: string): void {
    const selected = Array.isArray(this.answers[fieldId])
      ? [...(this.answers[fieldId] as string[])]
      : [];
    const index = selected.indexOf(optionId);
    if (index >= 0) selected.splice(index, 1);
    else selected.push(optionId);
    this.answers[fieldId] = selected;
  }

  isEmpty(value: unknown): boolean {
    return (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0) ||
      value === false
    );
  }
}
