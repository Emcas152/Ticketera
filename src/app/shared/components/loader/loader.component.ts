import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, afterNextRender, signal } from '@angular/core';
import { LoaderService } from '../../../core/services/loader.service';

@Component({
  selector: 'app-loader',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  template: `
    <div
      class="preloader"
      *ngIf="initializing() || (loader.loading$ | async)"
      role="status"
      aria-live="polite"
      aria-label="Cargando Alcon Ticket"
    >
      <div class="preloader__content">
        <img
          class="preloader__logo"
          src="assets/alcon_ticket_preloader.webp"
          alt="Alcon Ticket"
          width="560"
          height="315"
        />
        <div class="preloader__track" aria-hidden="true">
          <span class="preloader__progress"></span>
        </div>
        <span class="preloader__label">Preparando tu experiencia</span>
      </div>
    </div>
  `,
  styles: [
    `
      .preloader {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100dvh;
        padding: 24px;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 46%, rgba(106, 0, 255, 0.15), transparent 36%),
          #0d0d0d;
        z-index: 9999;
      }

      .preloader__content {
        position: absolute;
        top: 50%;
        left: 50%;
        width: min(560px, 82vw);
        display: flex;
        flex-direction: column;
        align-items: center;
        transform: translate(-50%, -50%);
      }

      .preloader__logo {
        display: block;
        width: 100%;
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 0 24px rgba(255, 0, 122, 0.24));
        animation: logo-breathe 1.8s ease-in-out infinite;
      }

      .preloader__track {
        position: relative;
        width: min(280px, 58vw);
        height: 3px;
        margin-top: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
      }

      .preloader__progress {
        position: absolute;
        inset: 0 auto 0 0;
        width: 42%;
        border-radius: inherit;
        background: linear-gradient(90deg, #6a00ff, #c000c8, #ff2d6f);
        box-shadow: 0 0 12px rgba(255, 0, 122, 0.7);
        animation: loading-line 1.15s ease-in-out infinite;
      }

      .preloader__label {
        margin-top: 15px;
        color: rgba(255, 255, 255, 0.72);
        font-family: Montserrat, sans-serif;
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      @keyframes logo-breathe {
        0%, 100% { transform: scale(0.985); opacity: 0.88; }
        50% { transform: scale(1); opacity: 1; }
      }

      @keyframes loading-line {
        0% { transform: translateX(-115%); }
        100% { transform: translateX(340%); }
      }

      @media (max-width: 480px) {
        .preloader__content { width: min(430px, 94vw); }
        .preloader__label { font-size: 0.62rem; letter-spacing: 0.12em; }
      }

      @media (prefers-reduced-motion: reduce) {
        .preloader__logo { animation: none; }
        .preloader__progress { animation-duration: 2.2s; }
      }
    `
  ]
})
export class LoaderComponent {
  readonly initializing = signal(true);

  constructor(public loader: LoaderService) {
    afterNextRender(() => {
      window.setTimeout(() => this.initializing.set(false), 700);
    });
  }
}
