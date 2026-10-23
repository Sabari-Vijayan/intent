import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="app-header" role="banner">
      <div class="header-content">
        <a routerLink="/" class="logo" aria-label="Intent home">
          <span>intent</span><i aria-hidden="true"></i>
        </a>
        <nav
          id="main-navigation"
          class="nav"
          [class.menu-open]="menuOpen()"
          aria-label="Main navigation"
        >
          <a href="#studio" class="nav-link" (click)="menuOpen.set(false)">Product</a>
          <a href="#architecture-title" class="nav-link" (click)="menuOpen.set(false)">Templates</a>
          <a href="#architecture-title" class="nav-link" (click)="menuOpen.set(false)">Use cases</a>
          <a href="#architecture-title" class="nav-link" (click)="menuOpen.set(false)"
            >Enterprise</a
          >
          <a href="#footer" class="nav-link" (click)="menuOpen.set(false)">Pricing</a>
        </nav>
        <div class="header-actions">
          <a routerLink="/auth" class="sign-in">Sign in</a
          ><a routerLink="/forms/new" class="header-cta"
            ><span class="desktop-cta-label">Start building free</span
            ><span class="mobile-cta-label">Build free</span> <span>↗</span></a
          >
        </div>
        <button
          class="menu-toggle"
          type="button"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="main-navigation"
          aria-label="Toggle navigation"
          (click)="menuOpen.set(!menuOpen())"
        >
          <span></span><span></span>
        </button>
        <a routerLink="/auth" class="avatar" aria-label="Open account"><span>⌁</span></a>
      </div>
    </header>
  `,
  styles: [
    `
      .app-header {
        position: fixed;
        top: 0;
        z-index: 100;
        width: 100%;
        background: rgb(248 248 245 / 82%);
        backdrop-filter: blur(18px);
        border-bottom: 1px solid rgb(20 20 20 / 0.06);
      }
      .header-content {
        max-width: 1280px;
        margin: 0 auto;
        min-height: 80px;
        padding: 0 32px;
        display: flex;
        align-items: center;
        gap: 52px;
      }
      .logo {
        display: flex;
        align-items: center;
        gap: 5px;
        color: #171717;
        text-decoration: none;
        font:
          500 25px/1 Georgia,
          serif;
        letter-spacing: -0.06em;
        text-transform: lowercase;
      }
      .logo i {
        width: 5px;
        height: 5px;
        margin-top: 13px;
        border-radius: 50%;
        background: currentColor;
      }
      .nav {
        display: flex;
        align-items: center;
        gap: 28px;
      }
      .nav-link {
        color: #747470;
        text-decoration: none;
        font:
          500 12px 'DM Sans',
          'Segoe UI',
          sans-serif;
        transition: color var(--transition-fast);
      }
      .nav-link:hover {
        color: #171717;
        text-decoration: none;
      }
      .header-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 22px;
      }
      .sign-in {
        color: #747470;
        font:
          500 12px 'DM Sans',
          'Segoe UI',
          sans-serif;
      }
      .sign-in:hover {
        color: #171717;
        text-decoration: none;
      }
      .header-cta {
        display: inline-flex;
        gap: 12px;
        align-items: center;
        background: #171717;
        color: #fff;
        padding: 12px 17px;
        border-radius: 30px;
        font:
          600 12px 'DM Sans',
          'Segoe UI',
          sans-serif;
      }
      .header-cta > span:last-child {
        font-size: 17px;
      }
      .mobile-cta-label,
      .menu-toggle {
        display: none;
      }
      .header-cta:hover {
        color: #fff;
        text-decoration: none;
        background: #393939;
      }
      .avatar {
        width: 31px;
        height: 31px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #171717;
        color: #fff;
        text-decoration: none;
        font-size: 18px;
      }
      .avatar:hover {
        color: #fff;
        text-decoration: none;
        transform: translateY(-1px);
      }
      @media (max-width: 920px) {
        .header-content {
          padding: 0 22px;
          gap: 20px;
        }
        .nav {
          display: none;
        }
        .nav.menu-open {
          position: absolute;
          top: calc(100% + 10px);
          left: 16px;
          right: 16px;
          display: grid;
          gap: 2px;
          padding: 8px;
          background: #fff;
          border: 1px solid #e5e5e0;
          border-radius: 16px;
          box-shadow: 0 18px 40px rgb(0 0 0 / 0.12);
        }
        .nav.menu-open .nav-link {
          padding: 12px;
          border-radius: 10px;
        }
        .nav.menu-open .nav-link:hover {
          background: #f3f3ef;
        }
        .menu-toggle {
          display: grid;
          place-content: center;
          gap: 5px;
          width: 40px;
          height: 40px;
          padding: 0;
          border: 1px solid #deded9;
          border-radius: 50%;
          background: #fff;
          cursor: pointer;
        }
        .menu-toggle span {
          display: block;
          width: 15px;
          height: 1.5px;
          background: #171717;
        }
      }
      @media (max-width: 520px) {
        .header-content {
          min-height: 68px;
          padding: 0 16px;
          gap: 10px;
        }
        .logo {
          font-size: 23px;
        }
        .sign-in,
        .avatar {
          display: none;
        }
        .header-actions {
          gap: 0;
        }
        .header-cta {
          padding: 10px 12px;
          font-size: 11px;
        }
        .desktop-cta-label {
          display: none;
        }
        .mobile-cta-label {
          display: inline;
        }
      }
      .nav-link.active {
        color: var(--color-primary);
        background: var(--color-primary-subtle);
      }
    `,
  ],
})
export class HeaderComponent {
  menuOpen = signal(false);
}
