import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseDataService } from '../../../core/supabase/supabase-data.service';
import { Field, Response, ResponseAnswer } from '../../../types/schema';

interface ReviewedResponse {
  response: Response;
  answers: ResponseAnswer[];
}

interface DistributionItem {
  label: string;
  count: number;
  percent: number;
  color: string;
}

interface QuestionInsight {
  label: string;
  type: string;
  total: number;
  items: DistributionItem[];
}

@Component({
  selector: 'app-response-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="responses-page">
      <header class="response-hero">
        <div class="response-hero-copy">
          <p class="page-kicker">Response inbox</p>
          <h1>{{ formTitle() || 'Responses' }}</h1>
          <p class="hero-lede">A clear read on who answered, where they answered from, and what they said.</p>
        </div>
        <div class="hero-actions">
          <span class="live-mark"><i aria-hidden="true"></i> Collecting responses</span>
          <button class="btn btn-primary" type="button" (click)="exportCsv()" [disabled]="responses().length === 0">
            <span aria-hidden="true">↓</span> Export CSV
          </button>
        </div>
      </header>

      @if (error()) {
        <div class="notice error" role="alert">{{ error() }}</div>
      }

      @if (loading()) {
        <section class="loading-panel" aria-live="polite">
          <span class="loading-mark" aria-hidden="true"><i></i><i></i><i></i></span>
          <p role="status">Loading responses</p>
        </section>
      }

      @if (!loading() && responses().length === 0) {
        <section class="empty-panel">
          <div class="empty-mark" aria-hidden="true">⌁</div>
          <p class="page-kicker">Your inbox is ready</p>
          <h2>No responses yet</h2>
          <p>Once someone submits this form, their answers will appear here.</p>
          <a routerLink="/forms" class="btn btn-secondary">Back to my forms</a>
        </section>
      }

      @if (!loading() && responses().length > 0) {
        <section class="summary-strip" aria-label="Response summary">
          <article class="summary-item summary-primary">
            <span class="summary-label">Total responses</span>
            <strong>{{ responses().length }}</strong>
            <small>{{ latestResponseLabel() }}</small>
          </article>
          <article class="summary-item">
            <span class="summary-label">Languages heard</span>
            <strong>{{ localeBreakdown().length }}</strong>
            <small>Original respondent languages</small>
          </article>
          <article class="summary-item">
            <span class="summary-label">Questions</span>
            <strong>{{ fieldCount() }}</strong>
            <small>Across the live form</small>
          </article>
          <article class="summary-item summary-latest">
            <span class="summary-label">Latest response</span>
            <strong>{{ latestResponseTime() }}</strong>
            <small>{{ latestResponseDate() }}</small>
          </article>
        </section>

        <section class="analytics-section" aria-labelledby="overview-title">
          <div class="section-heading">
            <div>
              <p class="page-kicker">At a glance</p>
              <h2 id="overview-title">The shape of your feedback</h2>
            </div>
            <span class="section-note">Last 7 days · {{ sevenDayTotal() }} submissions</span>
          </div>
          <div class="analytics-grid">
            <article class="panel volume-panel">
              <div class="panel-heading"><div><h3>Response rhythm</h3><p>Submissions over the last seven days</p></div><span class="chart-total">{{ sevenDayTotal() }}<small> this week</small></span></div>
              <div class="sparkline-wrap" role="img" [attr.aria-label]="'Response rhythm: ' + sevenDayTotal() + ' submissions over the last seven days'">
                <svg viewBox="0 0 700 190" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="0" y1="150" x2="700" y2="150" class="grid-line"/><line x1="0" y1="95" x2="700" y2="95" class="grid-line"/><line x1="0" y1="40" x2="700" y2="40" class="grid-line"/>
                  <polygon [attr.points]="trendAreaPoints()" class="trend-area"/><polyline [attr.points]="trendPoints()" class="trend-line"/>
                  @for (point of trendPointsList(); track point.label) { <circle [attr.cx]="point.x" [attr.cy]="point.y" r="5" class="trend-dot"><title>{{ point.label }}: {{ point.count }}</title></circle> }
                </svg>
                <div class="chart-labels">@for (day of trendData(); track day.label) { <span>{{ day.label }}</span> }</div>
              </div>
            </article>
            <article class="panel language-panel">
              <div class="panel-heading"><div><h3>Language mix</h3><p>Meet people in their own words</p></div></div>
              <div class="donut-row">
                <div class="donut" [style.background]="localeGradient()" role="img" aria-label="Response language mix"><div><strong>{{ responses().length }}</strong><span>answers</span></div></div>
                <ul class="legend">@for (locale of localeBreakdown(); track locale.label) { <li><i [style.background]="locale.color"></i><span>{{ locale.label }}</span><b>{{ locale.percent }}%</b></li> }</ul>
              </div>
            </article>
          </div>
          @if (questionInsights().length > 0) {
            <div class="insights-grid">
              @for (insight of questionInsights(); track insight.label) {
                <article class="panel insight-panel"><div class="panel-heading"><div><h3>{{ insight.label }}</h3><p>{{ insight.total }} answers · {{ insight.type }}</p></div></div><div class="distribution">@for (item of insight.items; track item.label) { <div class="distribution-row"><div class="distribution-meta"><span>{{ item.label }}</span><b>{{ item.percent }}%</b></div><div class="bar-track"><i [style.width.%]="item.percent" [style.background]="item.color"></i></div></div> }</div></article>
              }
            </div>
          }
        </section>

        <section class="feed-section" aria-labelledby="feed-title">
          <div class="feed-heading">
            <div>
              <p class="page-kicker">Read every voice</p>
              <h2 id="feed-title">Response feed</h2>
              <p class="feed-count">{{ responses().length }} submissions · originals are always preserved</p>
            </div>
            <div class="translation-tools" role="region" aria-label="Response translation controls">
              <div class="language-control">
                <label class="label" for="response-locale">Display language</label>
                <select class="input" id="response-locale" [(ngModel)]="targetLocale" (ngModelChange)="loadSavedTranslations()">@for (locale of enabledLocales(); track locale) { <option [value]="locale">{{ locale }}</option> }</select>
              </div>
              <button class="btn btn-secondary" type="button" [attr.aria-pressed]="showTranslated()" (click)="showTranslated.set(!showTranslated())">
                <span aria-hidden="true">{{ showTranslated() ? 'Aa' : '文' }}</span> {{ showTranslated() ? 'Show originals' : 'Show translations' }}
              </button>
            </div>
          </div>
          <p class="translation-note">{{ showTranslated() ? 'Showing saved translations when available.' : 'Showing original answers.' }} Translation never changes the submitted response.</p>

          @for (item of visibleResponses(); track item.response.id; let rowIndex = $index) {
            <article class="response-card">
              <header class="response-card-header">
                <div class="response-number"><span class="response-index">{{ (page() * pageSize + rowIndex + 1).toString().padStart(2, '0') }}</span><div><h3>Response {{ page() * pageSize + rowIndex + 1 }}</h3><p><time [attr.datetime]="item.response.submitted_at">{{ item.response.submitted_at | date: 'medium' }}</time></p></div></div>
                <div class="response-meta"><span class="locale-pill">{{ item.response.respondent_locale }}</span><span class="status-pill">{{ item.response.status === 'submitted' ? 'Submitted' : 'Partial' }}</span></div>
              </header>
              <div class="response-card-body">
                <dl class="answers-list">
                  @for (answer of item.answers; track answer.field_id; let answerIndex = $index) {
                    <div class="answer">
                      <div class="answer-label"><span class="question-index">{{ answerIndex + 1 }}</span><dt>{{ fieldLabel(answer.field_id) }}</dt></div>
                      <dd class="answer-value">
                        <p [class.answer-empty]="!displayAnswer(answer)">{{ displayAnswer(answer) || 'No answer provided' }}</p>
                        @if (isTextAnswer(answer) && !translatedAnswers()[answer.id]) {
                          <button class="translate-answer" type="button" (click)="translateAnswer(item.response, answer)" [disabled]="translatingAnswer() === answer.id">{{ translatingAnswer() === answer.id ? 'Translating…' : 'Translate answer' }}</button>
                        } @else if (isTextAnswer(answer) && showTranslated() && translatedAnswers()[answer.id]) {
                          <span class="translation-badge">Translated to {{ targetLocale }}</span>
                        }
                      </dd>
                    </div>
                  }
                </dl>
              </div>
            </article>
          }

          <div class="pagination" aria-label="Response pages">
            <button class="btn btn-secondary" type="button" (click)="page.set(page() - 1)" [disabled]="page() === 0"><span aria-hidden="true">←</span> Previous</button>
            <span>Page {{ page() + 1 }} of {{ pageCount() }}</span>
            <button class="btn btn-secondary" type="button" (click)="page.set(page() + 1)" [disabled]="page() + 1 >= pageCount()">Next <span aria-hidden="true">→</span></button>
          </div>
        </section>
      }
    </div>
  `,
  styles: [
    `
      :host { display: block; margin-top: -48px; }
      .responses-page { --response-ink: #20332c; --response-green: #39744e; --response-soft: #eaf2ea; --response-line: #dfe7df; max-width: 1180px; margin: 0 auto; padding: 28px 24px 80px; }
      .response-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; padding-bottom: 36px; border-bottom: 1px solid var(--response-line); }
      .response-hero-copy { min-width: 0; }
      .page-kicker { margin: 0 0 10px; color: var(--response-green); font-size: .7rem; font-weight: 700; letter-spacing: .1em; line-height: 1.2; text-transform: uppercase; }
      .response-hero h1 { max-width: 720px; color: var(--response-ink); font-family: var(--font-display); font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 400; letter-spacing: -.055em; line-height: .98; overflow-wrap: anywhere; }
      .hero-lede { max-width: 560px; margin: 18px 0 0; color: var(--color-text-secondary); font-size: 1.02rem; }
      .hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 18px; flex: 0 0 auto; }
      .live-mark { display: inline-flex; align-items: center; gap: 9px; color: var(--color-text-muted); font-size: var(--text-sm); white-space: nowrap; }
      .live-mark i { width: 8px; height: 8px; display: inline-block; border: 2px solid #72a782; border-radius: 50%; background: #d8efda; box-shadow: 0 0 0 3px #eef7ee; }
      .hero-actions .btn { min-width: 140px; }
      .hero-actions .btn span { font-size: 1.1rem; line-height: 0; }
      .notice.error { margin: 24px 0 0; padding: 13px 16px; border: 1px solid #edc9c5; border-radius: 10px; color: var(--color-error); background: var(--color-error-subtle); }
      .loading-panel, .empty-panel { display: grid; justify-items: center; text-align: center; }
      .loading-panel { gap: 12px; min-height: 280px; align-content: center; color: var(--color-text-muted); }
      .loading-panel p { margin: 0; }
      .loading-mark { display: inline-flex; gap: 4px; }
      .loading-mark i { width: 7px; height: 7px; border-radius: 50%; background: var(--response-green); animation: response-loading 1s ease-in-out infinite; }
      .loading-mark i:nth-child(2) { animation-delay: .15s; }
      .loading-mark i:nth-child(3) { animation-delay: .3s; }
      @keyframes response-loading { 0%, 100% { opacity: .3; transform: translateY(2px); } 50% { opacity: 1; transform: translateY(-2px); } }
      .empty-panel { max-width: 560px; margin: 72px auto; padding: 56px 28px; border: 1px solid var(--response-line); border-radius: 22px 6px 22px 22px; background: var(--color-surface-elevated); }
      .empty-mark { display: grid; width: 48px; height: 48px; place-items: center; margin-bottom: 22px; border-radius: 50%; color: var(--response-green); background: var(--response-soft); font-size: 1.8rem; }
      .empty-panel h2 { color: var(--response-ink); font-family: var(--font-display); font-size: 2rem; font-weight: 400; letter-spacing: -.04em; }
      .empty-panel > p:not(.page-kicker) { margin: 12px 0 24px; color: var(--color-text-secondary); }
      .summary-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 28px 0 56px; overflow: hidden; border: 1px solid var(--response-line); border-radius: 14px; background: var(--color-surface-elevated); }
      .summary-item { min-width: 0; min-height: 136px; padding: 23px 22px; border-left: 1px solid var(--response-line); }
      .summary-item:first-child { border-left: 0; }
      .summary-primary { background: var(--response-soft); }
      .summary-label { display: block; color: var(--color-text-secondary); font-size: var(--text-sm); }
      .summary-item strong { display: block; margin: 13px 0 3px; color: var(--response-ink); font-size: 2rem; font-weight: 500; letter-spacing: -.06em; line-height: 1; }
      .summary-item small { display: block; overflow: hidden; color: var(--color-text-muted); font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
      .analytics-section { margin-bottom: 64px; }
      .section-heading, .feed-heading, .panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
      .section-heading { margin-bottom: 20px; }
      .section-heading h2, .feed-heading h2 { color: var(--response-ink); font-family: var(--font-display); font-size: 2rem; font-weight: 400; letter-spacing: -.045em; }
      .section-note, .feed-count, .panel-heading p { color: var(--color-text-muted); font-size: var(--text-sm); }
      .section-note { padding-top: 27px; }
      .analytics-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .85fr); gap: 16px; }
      .panel { min-width: 0; padding: 25px; border: 1px solid var(--response-line); border-radius: 16px; background: var(--color-surface-elevated); }
      .panel-heading h3 { color: var(--response-ink); font-size: var(--text-lg); font-weight: 600; }
      .panel-heading p { margin: 5px 0 0; }
      .chart-total { color: var(--response-green); font-size: 1.7rem; font-weight: 600; letter-spacing: -.06em; line-height: 1; white-space: nowrap; }
      .chart-total small { color: var(--color-text-muted); font-size: .7rem; font-weight: 400; letter-spacing: 0; }
      .sparkline-wrap { margin-top: 28px; }
      .sparkline-wrap svg { display: block; width: 100%; height: 176px; overflow: visible; }
      .grid-line { stroke: #e7ebe4; stroke-width: 1; stroke-dasharray: 3 5; }
      .trend-area { fill: #deede0; }
      .trend-line { fill: none; stroke: var(--response-green); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
      .trend-dot { fill: var(--response-green); stroke: var(--color-surface-elevated); stroke-width: 3; }
      .chart-labels { display: flex; justify-content: space-between; color: var(--color-text-muted); font-size: .72rem; }
      .donut-row { display: flex; align-items: center; gap: 28px; min-height: 176px; margin-top: 14px; }
      .donut { display: grid; flex: 0 0 136px; width: 136px; height: 136px; place-items: center; border-radius: 50%; }
      .donut::before { content: ''; grid-area: 1 / 1; width: 84px; height: 84px; border-radius: 50%; background: var(--color-surface-elevated); }
      .donut > div { z-index: 1; grid-area: 1 / 1; text-align: center; }
      .donut strong { display: block; color: var(--response-ink); font-size: 1.55rem; letter-spacing: -.06em; line-height: 1; }
      .donut span { color: var(--color-text-muted); font-size: .72rem; }
      .legend { display: grid; flex: 1; gap: 12px; min-width: 0; margin: 0; padding: 0; list-style: none; }
      .legend li { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 8px; font-size: var(--text-sm); }
      .legend li span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .legend i { width: 8px; height: 8px; border-radius: 50%; }
      .legend b { font-weight: 600; }
      .insights-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
      .distribution { display: grid; gap: 15px; margin-top: 24px; }
      .distribution-meta { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: var(--text-sm); }
      .distribution-meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .distribution-meta b { font-weight: 600; }
      .bar-track { height: 7px; overflow: hidden; border-radius: 99px; background: #edf0eb; }
      .bar-track i { display: block; height: 100%; border-radius: inherit; }
      .feed-section { scroll-margin-top: 24px; }
      .feed-heading { align-items: flex-end; margin-bottom: 8px; }
      .feed-count { margin: 8px 0 0; }
      .translation-tools { display: flex; align-items: flex-end; gap: 12px; }
      .language-control { min-width: 144px; }
      .translation-tools .label { margin: 0 0 6px; color: var(--color-text-secondary); font-size: var(--text-xs); }
      .translation-tools .input { width: 100%; min-width: 0; }
      .translation-tools .btn { min-height: 40px; }
      .translation-tools .btn span { color: var(--response-green); font-weight: 700; }
      .translation-note { margin: 0 0 18px; color: var(--color-text-muted); font-size: var(--text-xs); }
      .response-card { margin-bottom: 16px; overflow: hidden; border: 1px solid var(--response-line); border-radius: 16px; background: var(--color-surface-elevated); box-shadow: 0 8px 24px rgb(28 45 35 / .04); }
      .response-card-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 20px 24px; background: #f4f7f3; }
      .response-number, .response-meta { display: flex; align-items: center; gap: 12px; }
      .response-index { display: grid; width: 36px; height: 36px; flex: 0 0 36px; place-items: center; border-radius: 50%; color: var(--response-green); background: #dceade; font-size: var(--text-xs); font-weight: 700; }
      .response-number h3 { color: var(--response-ink); font-size: var(--text-base); font-weight: 600; }
      .response-number p { margin: 4px 0 0; color: var(--color-text-muted); font-size: var(--text-xs); }
      .response-meta { flex-wrap: wrap; justify-content: flex-end; color: var(--color-text-muted); font-size: var(--text-xs); }
      .locale-pill, .status-pill, .translation-badge { display: inline-flex; align-items: center; border-radius: 999px; font-size: .72rem; white-space: nowrap; }
      .locale-pill { padding: 5px 9px; border: 1px solid #c6d8c9; color: #46604d; background: #e8f0e8; font-weight: 600; }
      .status-pill { padding: 5px 0; color: var(--color-text-muted); }
      .response-card-body { padding: 6px 24px 12px; }
      .answers-list { margin: 0; }
      .answer { display: grid; grid-template-columns: minmax(150px, .38fr) minmax(0, 1fr); gap: 28px; padding: 18px 0; border-bottom: 1px solid var(--response-line); }
      .answer:last-child { border-bottom: 0; }
      .answer-label { display: flex; align-items: flex-start; gap: 9px; min-width: 0; }
      .question-index { display: grid; width: 19px; height: 19px; flex: 0 0 19px; place-items: center; margin-top: 1px; border-radius: 50%; color: var(--response-green); background: var(--response-soft); font-size: .66rem; font-weight: 700; }
      .answer dt { color: var(--color-text-secondary); font-size: var(--text-sm); font-weight: 600; line-height: 1.45; overflow-wrap: anywhere; }
      .answer-value { min-width: 0; margin: 0; }
      .answer-value p { margin: 0; color: var(--color-text); white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.55; }
      .answer-empty { color: var(--color-text-muted) !important; font-style: italic; }
      .translate-answer { margin-top: 9px; padding: 0; border: 0; color: var(--response-green); background: transparent; font: 600 var(--text-xs) var(--font-sans); cursor: pointer; }
      .translate-answer:hover:not(:disabled) { color: var(--response-ink); text-decoration: underline; }
      .translate-answer:disabled { color: var(--color-text-muted); cursor: wait; }
      .translation-badge { margin-top: 9px; padding: 3px 7px; color: #58705d; background: #eef5ed; }
      .pagination { display: flex; align-items: center; justify-content: center; gap: 18px; margin: 28px 0 0; color: var(--color-text-muted); font-size: var(--text-sm); }
      .pagination .btn { min-width: 105px; }
      @media (prefers-reduced-motion: reduce) { .loading-mark i { animation: none; } }
      @media (max-width: 900px) {
        .response-hero { align-items: flex-start; flex-direction: column; }
        .hero-actions { align-items: flex-start; flex-direction: row; }
        .summary-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .summary-item:nth-child(3) { border-left: 0; border-top: 1px solid var(--response-line); }
        .summary-item:nth-child(4) { border-top: 1px solid var(--response-line); }
        .analytics-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 680px) {
        :host { margin-top: -24px; }
        .responses-page { padding: 20px 16px 56px; }
        .response-hero { padding-bottom: 28px; }
        .response-hero h1 { font-size: 2.7rem; }
        .hero-lede { margin-top: 14px; }
        .hero-actions { align-items: stretch; flex-direction: column; width: 100%; gap: 13px; }
        .hero-actions .btn { width: 100%; }
        .summary-strip { margin-bottom: 42px; }
        .summary-item { min-height: 118px; padding: 18px 16px; }
        .summary-item strong { font-size: 1.75rem; }
        .section-heading, .feed-heading { align-items: flex-start; flex-direction: column; }
        .section-note { padding-top: 0; }
        .panel { padding: 20px 16px; }
        .donut-row { gap: 20px; }
        .donut { flex-basis: 116px; width: 116px; height: 116px; }
        .donut::before { width: 73px; height: 73px; }
        .insights-grid { grid-template-columns: 1fr; }
        .translation-tools { align-items: stretch; flex-direction: column; width: 100%; gap: 10px; }
        .language-control { width: 100%; }
        .translation-tools .btn { width: 100%; }
        .response-card-header { align-items: flex-start; flex-direction: column; padding: 17px 16px; gap: 13px; }
        .response-meta { justify-content: flex-start; }
        .response-card-body { padding: 2px 16px 8px; }
        .answer { display: block; padding: 16px 0; }
        .answer-label { margin-bottom: 8px; }
        .pagination { justify-content: space-between; gap: 8px; }
        .pagination .btn { min-width: 0; padding: 8px 11px; }
        .pagination span { white-space: nowrap; }
      }
      @media (max-width: 400px) {
        .summary-item small { white-space: normal; }
        .donut-row { align-items: flex-start; flex-direction: column; }
        .donut { align-self: center; }
        .legend { width: 100%; }
        .pagination span { font-size: var(--text-xs); }
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
  formTitle = signal('');
  fieldLabels = signal<Record<string, string>>({});
  private readonly fields = signal<Record<string, Field>>({});
  enabledLocales = signal<string[]>(['en']);
  translatedAnswers = signal<Record<string, string>>({});
  showTranslated = signal(false);
  translatingAnswer = signal('');
  targetLocale = 'en';
  readonly pageSize = 10;
  private readonly chartColors = ['#39744e', '#d8894d', '#557aa5', '#a86d91', '#8b9560'];

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const formId = this.route.snapshot.paramMap.get('id');
      if (!formId) throw new Error('Form ID is missing.');
      const form = await this.data.formWithCurrentVersion(formId);
       if (form.version) {
         this.formTitle.set(form.version.schema_json.title);
        this.enabledLocales.set(form.version.schema_json.enabled_locales);
        this.targetLocale = form.version.schema_json.default_locale;
        const allFields = form.version.schema_json.sections.flatMap((section) => section.fields);
        this.fieldLabels.set(Object.fromEntries(allFields.map((field) => [field.id, field.label])));
        this.fields.set(Object.fromEntries(allFields.map((field) => [field.id, field])));
      }
      this.responses.set(await this.data.responsesForForm(formId));
      await this.loadSavedTranslations();
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

  fieldCount(): number {
    return Object.keys(this.fields()).length;
  }

  latestResponse(): ReviewedResponse | undefined {
    return [...this.responses()].sort((a, b) => Date.parse(b.response.submitted_at) - Date.parse(a.response.submitted_at))[0];
  }

  latestResponseDate(): string {
    const latest = this.latestResponse();
    return latest ? new Date(latest.response.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  }

  latestResponseTime(): string {
    const latest = this.latestResponse();
    return latest ? new Date(latest.response.submitted_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—';
  }

  latestResponseLabel(): string {
    const latest = this.latestResponse();
    return latest ? `Last received ${this.latestResponseDate()}` : 'No submissions yet';
  }

  localeBreakdown(): DistributionItem[] {
    const counts = new Map<string, number>();
    this.responses().forEach((item) => counts.set(item.response.respondent_locale, (counts.get(item.response.respondent_locale) ?? 0) + 1));
    const total = this.responses().length || 1;
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count], index) => ({ label, count, percent: Math.round((count / total) * 100), color: this.chartColors[index % this.chartColors.length] }));
  }

  trendData(): Array<{ label: string; count: number }> {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(date.getDate() + 1);
      return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), count: this.responses().filter((item) => { const submitted = Date.parse(item.response.submitted_at); return submitted >= date.getTime() && submitted < next.getTime(); }).length };
    });
  }

  sevenDayTotal(): number { return this.trendData().reduce((total, day) => total + day.count, 0); }

  trendPointsList(): Array<{ label: string; count: number; x: number; y: number }> {
    const data = this.trendData();
    const max = Math.max(...data.map((day) => day.count), 1);
    return data.map((day, index) => ({ ...day, x: (index / 6) * 700, y: 150 - (day.count / max) * 110 }));
  }

  trendPoints(): string { return this.trendPointsList().map((point) => `${point.x},${point.y}`).join(' '); }
  trendAreaPoints(): string { return `0,150 ${this.trendPoints()} 700,150`; }

  localeGradient(): string {
    let start = 0;
    const stops = this.localeBreakdown().map((locale) => { const end = start + locale.percent; const stop = `${locale.color} ${start}% ${end}%`; start = end; return stop; });
    return `conic-gradient(${stops.join(', ') || '#dfe6df 0 100%'})`;
  }

  questionInsights(): QuestionInsight[] {
    const insights: QuestionInsight[] = [];
    Object.entries(this.fields()).forEach(([fieldId, field]) => {
      if (!field.options?.length && field.type !== 'rating') return;
      const answers = this.responses().flatMap((item) => item.answers.filter((answer) => answer.field_id === fieldId));
      const counts = new Map<string, number>();
      answers.forEach((answer) => {
        const values = Array.isArray(answer.value_json) ? answer.value_json : [answer.value_json];
        values.forEach((value) => { const label = field.options?.find((option) => option.id === String(value))?.label ?? String(value); counts.set(label, (counts.get(label) ?? 0) + 1); });
      });
      const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
      if (!total) return;
      insights.push({ label: field.label, type: field.type === 'rating' ? 'rating' : 'choice', total, items: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count], index) => ({ label, count, percent: Math.round((count / total) * 100), color: this.chartColors[index % this.chartColors.length] })) });
    });
    return insights.slice(0, 4);
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
    if (this.showTranslated() && this.translatedAnswers()[answer.id]) return this.translatedAnswers()[answer.id];
    const field = this.fields()[answer.field_id];
    const optionLabels = new Map((field?.options ?? []).map((option) => [option.id, option.label]));
    if (Array.isArray(answer.value_json)) {
      return answer.value_json
        .map((value) => optionLabels.get(String(value)) ?? String(value))
        .join(', ');
    }
    return optionLabels.get(String(answer.value_json)) ?? this.displayValue(answer.value_json);
  }

  isTextAnswer(answer: ResponseAnswer): boolean {
    const type = this.fields()[answer.field_id]?.type;
    return type === 'short_text' || type === 'long_text' || type === 'email';
  }

  async loadSavedTranslations(): Promise<void> {
    const answerIds = this.responses().flatMap((item) => item.answers.map((answer) => answer.id).filter(Boolean));
    try {
      const translations = await this.data.answerTranslations(answerIds, this.targetLocale);
      this.translatedAnswers.set(Object.fromEntries(translations.map((translation) => [translation.answer_id, translation.text])));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not load translations.');
    }
  }

  async translateAnswer(response: Response, answer: ResponseAnswer): Promise<void> {
    if (!answer.id || !this.isTextAnswer(answer)) return;
    const source = typeof answer.value_json === 'string' ? answer.value_json : this.displayValue(answer.value_json);
    this.translatingAnswer.set(answer.id);
    try {
      const result = await this.data.translateResponse(source, response.respondent_locale, this.targetLocale);
      await this.data.saveAnswerTranslation(answer.id, this.targetLocale, result.text, result.provider, result.model);
      this.translatedAnswers.update((translations) => ({ ...translations, [answer.id]: result.text }));
      this.showTranslated.set(true);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Could not translate this response.');
    } finally {
      this.translatingAnswer.set('');
    }
  }

  exportCsv(): void {
    const rows = [['submitted_at', 'respondent_locale', 'field_id', 'original_answer', `translated_answer_${this.targetLocale}`]];
    this.responses().forEach((item) =>
      item.answers.forEach((answer) =>
        rows.push([
          item.response.submitted_at,
          item.response.respondent_locale,
          answer.field_id,
          this.displayValue(answer.value_json),
          this.translatedAnswers()[answer.id] ?? '',
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
