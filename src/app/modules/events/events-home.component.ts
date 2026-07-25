import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, shareReplay } from 'rxjs';
import { EventService } from '../../core/services/event.service';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-events-home',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, EventCardComponent, ...MATERIAL_IMPORTS],
  template: `
    <ng-container *ngIf="featuredEvents$ | async as featuredEvents">
      <section *ngIf="featuredEvents.length" class="event-carousel page-shell" aria-label="Eventos destacados">
        <a [routerLink]="['/events', featuredEvents[bannerIndex].id]" class="carousel-backdrop">
          <img [src]="featuredEvents[bannerIndex].image" [alt]="'Banner de ' + featuredEvents[bannerIndex].name" />
          <span class="carousel-shade"></span>
          <span class="carousel-bottom-shade"></span>
        </a>

        <div class="carousel-content">
          <div>
            <p class="carousel-eyebrow">
              {{ featuredEvents[bannerIndex].category }} · {{ featuredEvents[bannerIndex].city }}
            </p>
            <h1>{{ featuredEvents[bannerIndex].name }}</h1>
            <p class="carousel-date">{{ featuredEvents[bannerIndex].date | date: 'EEEE d MMM, h:mm a' }}</p>
            <a mat-flat-button color="primary" [routerLink]="['/booking', featuredEvents[bannerIndex].id, 'seats']">
              Ver boletos
            </a>
          </div>
        </div>

        <ng-container *ngIf="featuredEvents.length > 1">
          <button type="button" class="carousel-arrow carousel-arrow-left" (click)="previousBanner(featuredEvents.length)" aria-label="Evento anterior">‹</button>
          <button type="button" class="carousel-arrow carousel-arrow-right" (click)="nextBanner(featuredEvents.length)" aria-label="Evento siguiente">›</button>
          <div class="carousel-dots" aria-label="Seleccionar evento">
            <button
              *ngFor="let event of featuredEvents; let index = index"
              type="button"
              [class.active]="bannerIndex === index"
              (click)="selectBanner(index)"
              [attr.aria-label]="'Mostrar ' + event.name"
            ></button>
          </div>
        </ng-container>
      </section>
    </ng-container>

    <section class="page-shell section-gap">
      <div class="section-head">
        <div>
          <p class="eyebrow">Featured drops</p>
          <h2>Eventos destacados</h2>
        </div>
        <a mat-button routerLink="/events">Ver catalogo completo</a>
      </div>

      <div class="card-grid">
        <app-event-card *ngFor="let event of featuredEvents$ | async" [event]="event" />
      </div>
    </section>

    <section class="page-shell value-grid">
      <article class="panel-surface">
        <h3>Arquitectura modular</h3>
        <p>Core, shared, layouts y modulos separados para crecer sin deuda accidental.</p>
      </article>
      <article class="panel-surface">
        <h3>Seating interactivo</h3>
        <p>Mapa visual por filas y localidades con estados disponibles, reservados y vendidos.</p>
      </article>
      <article class="panel-surface">
        <h3>JWT + guards</h3>
        <p>Sesion persistente, interceptores HTTP y proteccion de rutas para booking y dashboard.</p>
      </article>
    </section>
  `,
  styles: [
    `
      .event-carousel {
        position: relative;
        min-height: 420px;
        overflow: hidden;
        border: 1px solid var(--surface-border);
        border-radius: var(--radius-lg);
        background: #000;
        box-shadow: var(--shadow-soft);
      }

      .carousel-backdrop,
      .carousel-backdrop img,
      .carousel-shade,
      .carousel-bottom-shade {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .carousel-backdrop img { object-fit: cover; }
      .carousel-shade { background: linear-gradient(90deg, rgba(0, 0, 0, .9), rgba(0, 0, 0, .45) 52%, rgba(0, 0, 0, .15)); }
      .carousel-bottom-shade { background: linear-gradient(0deg, rgba(0, 0, 0, .65), transparent 58%, rgba(0, 0, 0, .1)); }

      .carousel-content {
        position: relative;
        z-index: 2;
        display: flex;
        min-height: 420px;
        align-items: end;
        padding: 40px;
        color: white;
        pointer-events: none;
      }

      .carousel-content > div { max-width: 580px; }
      .carousel-content h1 { margin: 16px 0; font-size: clamp(2rem, 4vw, 3rem); line-height: 1.05; }
      .carousel-content a { margin-top: 16px; pointer-events: auto; }
      .carousel-eyebrow { margin: 0; font-size: .75rem; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
      .carousel-date { margin: 0; color: rgba(255, 255, 255, .84); font-weight: 600; }

      .carousel-arrow {
        position: absolute;
        z-index: 3;
        top: 50%;
        width: 44px;
        height: 44px;
        border: 0;
        border-radius: 50%;
        color: white;
        background: rgba(0, 0, 0, .55);
        font-size: 2rem;
        cursor: pointer;
        transform: translateY(-50%);
      }

      .carousel-arrow:hover { background: rgba(0, 0, 0, .75); }
      .carousel-arrow-left { left: 16px; }
      .carousel-arrow-right { right: 16px; }
      .carousel-dots { position: absolute; z-index: 3; right: 20px; bottom: 20px; display: flex; gap: 8px; }
      .carousel-dots button { width: 10px; height: 10px; padding: 0; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .4); cursor: pointer; transition: .2s; }
      .carousel-dots button.active { width: 32px; background: white; }

      .eyebrow {
        color: var(--text-muted);
      }

      .section-gap {
        margin-top: 32px;
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 16px;
        margin-bottom: 18px;
      }

      .card-grid,
      .value-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 20px;
      }

      @media (max-width: 1024px) {
        .card-grid,
        .value-grid {
          grid-template-columns: 1fr;
        }

        .event-carousel,
        .carousel-content { min-height: 360px; }
        .carousel-content { padding: 28px; }
      }
    `
  ]
})
export class EventsHomeComponent implements OnDestroy {
  private readonly events = inject(EventService);
  readonly featuredEvents$ = this.events.getFeaturedEvents().pipe(
    map((items) => items.slice(0, 3)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  bannerIndex = 0;
  private readonly carouselTimer = window.setInterval(() => {
    this.featuredEvents$.subscribe((events) => {
      if (events.length > 1) this.nextBanner(events.length);
    }).unsubscribe();
  }, 6000);

  nextBanner(total: number): void { this.bannerIndex = (this.bannerIndex + 1) % total; }
  previousBanner(total: number): void { this.bannerIndex = (this.bannerIndex - 1 + total) % total; }
  selectBanner(index: number): void { this.bannerIndex = index; }
  ngOnDestroy(): void { window.clearInterval(this.carouselTimer); }
}
