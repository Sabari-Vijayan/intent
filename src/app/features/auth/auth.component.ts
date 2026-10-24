import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseDataService } from '../../core/supabase/supabase-data.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-wrap">
      <section class="card auth-card" aria-labelledby="auth-title">
        <div class="card-body">
          <h1 id="auth-title">{{ signUp() ? 'Create your account' : 'Sign in to Intent' }}</h1>
          <p class="help-text">Your forms are private to your workspace.</p>
          <form (ngSubmit)="submit()">
            <div class="form-group">
              <label class="label" for="email">Email</label
              ><input
                class="input"
                id="email"
                name="email"
                type="email"
                required
                [(ngModel)]="email"
              />
            </div>
            <div class="form-group">
              <label class="label" for="password">Password</label
              ><input
                class="input"
                id="password"
                name="password"
                type="password"
                minlength="6"
                required
                [(ngModel)]="password"
              />
            </div>
            @if (error()) {
              <p class="error-text" role="alert">{{ error() }}</p>
            }
            @if (message()) {
              <p class="success-text" role="status">{{ message() }}</p>
            }
            <button class="btn btn-primary" type="submit" [disabled]="busy()">
              {{ busy() ? 'Working…' : signUp() ? 'Create account' : 'Sign in' }}
            </button>
          </form>
          <button
            class="switch-button"
            type="button"
            (click)="signUp.set(!signUp()); error.set(''); message.set('')"
          >
            {{ signUp() ? 'Already have an account? Sign in' : 'New here? Create an account' }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .auth-wrap {
        max-width: 456px;
        width: calc(100% - 32px);
        margin: clamp(24px, 8vh, 72px) auto;
      }
      .auth-card {
        border-color: #e3e3dd;
        box-shadow: 0 18px 50px rgb(28 28 24 / 0.07);
      }
      .auth-card h1 {
        margin-bottom: var(--space-2);
        font-size: clamp(2rem, 5vw, 2.7rem);
      }
      .auth-card form {
        margin-top: var(--space-6);
      }
      .switch-button {
        border: 0;
        background: transparent;
        color: var(--color-primary);
        padding: var(--space-4) 0 0;
        cursor: pointer;
      }
      .success-text {
        color: var(--color-success);
      }
      .auth-card .btn {
        width: 100%;
        min-height: 44px;
      }
      @media (max-width: 480px) {
        .auth-wrap {
          width: calc(100% - 24px);
          margin: 20px auto;
        }
        .auth-card .card-body {
          padding: 22px 18px;
        }
        .auth-card h1 {
          font-size: 1.7rem;
        }
      }
    `,
  ],
})
export class AuthComponent {
  private readonly data = inject(SupabaseDataService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  email = '';
  password = '';
  signUp = signal(false);
  busy = signal(false);
  error = signal('');
  message = signal('');

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      if (this.signUp()) {
        await this.data.signUp(this.email, this.password);
        this.message.set(
          'Account created. Check your email if confirmation is enabled, then sign in.'
        );
      } else {
        await this.data.signIn(this.email, this.password);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        await this.router.navigateByUrl(
           returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/forms'
        );
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      this.busy.set(false);
    }
  }
}
