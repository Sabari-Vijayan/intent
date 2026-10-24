import { AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChildren, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type Locale = 'en' | 'ja' | 'de' | 'es';

interface LocaleCopy {
  pill: string;
  question: string;
  subtext: string;
  options: string[];
  continue: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="home-shell">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-art" aria-hidden="true">
          @for (card of cards; track card.image; let i = $index) {
            <div class="art-card card-{{ i + 1 }}">
              <div class="art-image" [style.background-image]="'url(' + card.image + ')'">
                @if (card.label) { <span class="art-label">{{ card.label }}</span> }
              </div>
            </div>
          }
        </div>
        <div class="hero-copy">
           <h1 id="hero-title">Make every question<br /><em>feel understood.</em></h1>
          <p class="hero-lede">
            Describe what you need in plain language. Intent turns it into a thoughtful,
            multilingual form your audience can actually finish.
          </p>
          <div class="hero-actions">
            <a routerLink="/forms/new" class="button button-dark">Start building free <span>↗</span></a>
            <a href="#studio" class="text-link">See it in action <span>↓</span></a>
          </div>
          <div class="prompt-box">
            <span class="spark">✦</span>
            <input [(ngModel)]="prompt" aria-label="Describe the form you want to create" />
            <button type="button" (click)="sendPrompt()">Synthesize <span>↗</span></button>
          </div>
          @if (promptSent()) {
            <p class="prompt-note" role="status">Brief ready — opening the form builder.</p>
          }
        </div>

      </section>

      <section #reveal class="phone-section reveal" aria-labelledby="phone-title">
        <div class="phone-stage" aria-hidden="true"><img src="assets/images/Floating_Minimalist_Form_Phone.png" alt="" /></div>
        <div class="phone-copy">
          <span class="section-kicker">Made for the moment</span>
          <h2 id="phone-title">A better question fits in the hand.</h2>
          <p>Clean, calm forms meet people wherever they are answering — without turning a thoughtful response into a chore.</p>
          <a href="#studio" class="text-link">See the form in context <span>↓</span></a>
        </div>
      </section>

      <section #reveal class="proof-strip reveal" aria-label="Intent benefits">
        <article><strong>Culturally aware</strong><span>Politeness, rhythm, and local context across 95+ regions.</span></article>
        <article><strong>Instantly editable</strong><span>From a rough brief to a polished form in seconds.</span></article>
        <article><strong>Private by design</strong><span>PII stays protected while your intent moves forward.</span></article>
      </section>

      <section #reveal class="studio-section reveal" id="studio" aria-labelledby="studio-title">
        <div class="section-intro">
          <span class="section-kicker">A live preview</span>
          <h2 id="studio-title">Your intent, in context.</h2>
          <p>Switch the language and see how the same question becomes more natural for the person answering it.</p>
        </div>
        <div class="studio-card">
          <div class="studio-sidebar">
            <div class="window-dots"><i></i><i></i><i></i><span>intent / studio</span></div>
            <label for="brief">Your brief</label>
            <textarea id="brief" [(ngModel)]="brief" rows="4"></textarea>
            <label>Adaptive choices</label>
            <div class="directive"><span>◎</span><div><b>Respect the register</b><small>Formal when context calls for it</small></div><strong>On</strong></div>
            <div class="directive"><span>⌁</span><div><b>Keep it human</b><small>One clear intent per question</small></div><strong>On</strong></div>
            <div class="studio-metrics"><span>Response readiness <b>98.4%</b></span><span>Translation latency <b>118ms</b></span></div>
          </div>
          <div class="preview-panel">
            <div class="locale-tabs" role="tablist" aria-label="Preview language">
              @for (locale of locales; track locale.key) {
                <button type="button" role="tab" [attr.aria-selected]="activeLocale() === locale.key" [class.selected]="activeLocale() === locale.key" (click)="setLocale(locale.key)">{{ locale.label }}</button>
              }
            </div>
            <div class="form-preview">
              <div class="preview-meta"><span>Question 1 of 3</span><b>{{ copy().pill }}</b></div>
              <h3>{{ copy().question }}</h3>
              <p>{{ copy().subtext }}</p>
              <div class="options">
                @for (option of copy().options; track option; let i = $index) {
                  <label><input type="radio" name="preview-option" [checked]="i === 0" /><span>{{ option }}</span><small>{{ [64, 28, 8][i] }}%</small></label>
                }
              </div>
              <div class="preview-bottom"><span>⌁ No personal data retained</span><button type="button">{{ copy().continue }} <span>↗</span></button></div>
            </div>
            <div class="engine-status"><span><i></i> Synthesis engine running</span><code>HTTP 200 · 124ms</code></div>
          </div>
        </div>
      </section>

      <section #reveal class="architecture reveal" aria-labelledby="architecture-title">
        <div class="section-intro left"><span class="section-kicker">The difference is in the details</span><h2 id="architecture-title">Translation gets words across.<br />Intent gets people there.</h2><p>Every form is shaped around the person answering it — their language, their context, and their comfort.</p></div>
        <div class="feature-grid">
          <article class="feature feature-wide"><div class="feature-icon">文</div><span class="feature-kicker">Cultural calibration</span><h3>Say it like a local.</h3><p>Honorifics, idioms, and formality shift with the situation — not just the dictionary.</p><div class="language-pair"><div><small>Too literal</small><b>Tell us your budget.</b></div><div><small>Calibrated for Japan</small><b>ご予算をお聞かせいただけますでしょうか。</b></div></div></article>
          <article class="feature"><div class="feature-icon">↗</div><span class="feature-kicker">Smart branching</span><h3>Follow the signal.</h3><p>Thoughtful follow-ups appear when an answer needs a little more room.</p><div class="mini-stat"><b>-34.8%</b><span>less drop-off</span><svg viewBox="0 0 100 30" aria-hidden="true"><path d="M2 26 C25 25 27 14 45 17 S67 8 98 3" /></svg></div></article>
          <article class="feature"><div class="feature-icon">◌</div><span class="feature-kicker">One clear picture</span><h3>Understand the whole room.</h3><p>Bring responses from every region together without flattening their meaning.</p><div class="bars"><span><i style="width:88%"></i>EMEA <b>88%</b></span><span><i style="width:94%"></i>APAC <b>94%</b></span></div></article>
          <article class="feature feature-wide security"><div class="feature-icon">⌁</div><span class="feature-kicker">Private by default</span><h3>Your data has a home. It shouldn’t have a second one.</h3><p>PII is masked at the edge. Regional controls and immutable versions keep every response accountable.</p><div class="region-pills"><span>Tokyo · APPI</span><span>Frankfurt · GDPR</span><span>Virginia · SOC 2</span><span>São Paulo · LGPD</span></div></article>
        </div>
      </section>

       <section #reveal class="closing-cta reveal" aria-label="Proof and next step">
         <div class="closing-quote"><div><span class="quote-mark">“</span><blockquote>We launched a 12-country study in an afternoon that used to take three weeks of translation back-and-forth.</blockquote><p><b>Elena Rostova</b> · Head of Global UX Research, CloudSync</p></div><div class="quote-result"><small>Study result</small><strong>88%</strong><span>faster kickoff to synthesis</span></div></div>
         <div class="final-cta"><span class="section-kicker">Ready when you are</span><h2>Give your next question<br /><em>a better chance.</em></h2><p>Start with a sentence. Leave with a form your audience will want to answer.</p><a routerLink="/forms/new" class="button button-light">Start building free <span>↗</span></a></div>
       </section>
      <footer #reveal class="site-footer reveal" id="footer">
        <div class="footer-main">
          <div class="footer-brand"><a routerLink="/" class="footer-logo">intent<i></i></a><p>The thoughtful way to turn raw intent into forms people want to answer — in every language.</p><form (submit)="$event.preventDefault()"><label for="footer-email">A note when we launch</label><div class="footer-signup"><input id="footer-email" type="email" placeholder="you@company.com" /><button type="submit">Subscribe <span>↗</span></button></div></form></div>
          <div class="footer-links"><div><h3>Product</h3><a href="#studio">AI form builder</a><a href="#studio">Multilingual forms</a><a href="#architecture-title">Global insights</a><a href="#architecture-title">Enterprise security</a></div><div><h3>Explore</h3><a href="#architecture-title">Research intake</a><a href="#architecture-title">KYC & onboarding</a><a href="#architecture-title">Customer feedback</a><a href="#architecture-title">Templates</a></div><div><h3>Governance</h3><a routerLink="/auth">Privacy policy</a><a routerLink="/auth">Terms of service</a><a routerLink="/auth">Security</a><a routerLink="/auth">Contact</a></div></div>
        </div>
        <div class="footer-bottom"><span>© 2026 Intent Systems, Inc.</span><div><span class="status-dot"></span><span>All systems normal</span><span>Built for the details</span></div></div>
      </footer>
    </div>
  `,
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('reveal', { read: ElementRef }) revealElements!: QueryList<ElementRef<HTMLElement>>;
  private observer?: IntersectionObserver;
  prompt = 'A customer satisfaction survey for our new product';
  brief = 'Design an executive onboarding survey measuring friction in enterprise cloud migrations.';
  promptSent = signal(false);
  activeLocale = signal<Locale>('en');

  readonly cards = [
    { image: 'assets/images/sunset_curve.jpg', label: 'EN · Direct' },
    { image: 'assets/images/dragon_tree_curve.jpg', label: 'JA · 敬語' },
     { image: 'assets/images/mountains_curve.jpg', label: 'DE · Formal' },
    { image: 'assets/images/boaboa_tree_curve.jpg', label: 'ES · Claro' },
     { image: 'assets/images/machu-pichu_curve.jpg', label: 'ES · Claro' },
  ];
  readonly locales = [
    { key: 'en' as Locale, label: 'English (US)' },
    { key: 'ja' as Locale, label: '日本語 (敬語)' },
    { key: 'de' as Locale, label: 'Deutsch (Formell)' },
    { key: 'es' as Locale, label: 'Español (LatAm)' },
  ];
  readonly copies: Record<Locale, LocaleCopy> = {
    en: { pill: 'en-US · Direct', question: 'What was the primary blocker during your cloud migration?', subtext: 'Select the area where your team spent unexpected overhead.', options: ['Data sovereignty & cross-region latency', 'IAM permissions & audit alignment', 'Developer onboarding & CLI ergonomics'], continue: 'Continue' },
    ja: { pill: 'ja-JP · 厳格な敬語', question: 'クラウド移行で、最も時間を要した課題はどのような点でしょうか？', subtext: '想定外の工数が発生した領域をお聞かせください。', options: ['データ主権とリージョン間のレイテンシ', 'IAM権限と監査との整合性', '開発者オンボーディングとCLI操作性'], continue: '次へ進む' },
    de: { pill: 'de-DE · Formell (Sie)', question: 'Was war das größte Hindernis während Ihrer Cloud-Migration?', subtext: 'Bitte wählen Sie den Bereich mit dem größten Mehraufwand.', options: ['Datensouveränität und Replikationslatenz', 'IAM-Berechtigungen und Audit-Konformität', 'Einarbeitung und Ergonomie der CLI-Tools'], continue: 'Weiter' },
    es: { pill: 'es-419 · Profesional', question: '¿Cuál fue el principal obstáculo durante su migración a la nube?', subtext: 'Seleccione el aspecto con mayor sobrecarga inesperada.', options: ['Soberanía de datos y latencia entre regiones', 'Permisos IAM y alineación con auditorías', 'Incorporación y ergonomía de la CLI'], continue: 'Continuar' },
  };

  copy(): LocaleCopy { return this.copies[this.activeLocale()]; }
  setLocale(locale: Locale): void { this.activeLocale.set(locale); }
  sendPrompt(): void { this.promptSent.set(true); }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.revealElements.forEach((element) => element.nativeElement.classList.add('is-visible'));
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          this.observer?.unobserve(entry.target);
        }
      }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    this.revealElements.forEach((element) => this.observer?.observe(element.nativeElement));
  }

  ngOnDestroy(): void { this.observer?.disconnect(); }
}
