import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { EventService } from '../../core/services/event.service';
import { EventCardComponent } from '../../shared/components/event-card/event-card.component';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-events-home',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterLink, EventCardComponent, ...MATERIAL_IMPORTS],
  template: `
    <section class="hero page-shell">
      <div class="hero-copy">
        <p class="eyebrow">Event commerce platform</p>
        <h1>Descubre, reserva y gestiona eventos con una UX lista para escalar.</h1>
        <p class="lead">
          Frontend SaaS inspirado en Ticketmaster, Eventbrite y Airbnb UI, con compra de tickets,
          seating visual, dashboard de usuario y arquitectura desacoplada para API REST.
        </p>
        <div class="hero-actions">
          <a mat-flat-button routerLink="/events">Explorar eventos</a>
          <a mat-stroked-button routerLink="/auth/register">Crear cuenta</a>
        </div>
      </div>

      <div class="hero-panel panel-surface">
        <div class="metric">
          <strong>+120</strong>
          <span>Eventos activos</span>
        </div>
        <div class="metric">
          <strong>98%</strong>
          <span>Checkout completion</span>
        </div>
        <div class="metric">
          <strong>4.9</strong>
          <span>Valoracion promedio</span>
        </div>
      </div>
    </section>

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
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
        gap: 24px;
        align-items: stretch;
      }

      .hero-copy {
        padding: 56px;
        border-radius: 36px;
        background:
          radial-gradient(circle at top left, rgba(255, 127, 17, 0.28), transparent 32%),
          radial-gradient(circle at bottom right, rgba(15, 98, 254, 0.22), transparent 42%),
          linear-gradient(145deg, #07111b 0%, #102238 100%);
        color: #f3f7ff;
      }

      .hero-copy h1 {
        margin: 0 0 18px;
        font-size: clamp(2rem, 5vw, 4.2rem);
        line-height: 0.98;
      }

      .lead {
        max-width: 58ch;
        color: rgba(243, 247, 255, 0.78);
      }

      .hero-actions {
        display: flex;
        gap: 12px;
        margin-top: 28px;
      }

      .hero-panel {
        display: grid;
        align-content: center;
        gap: 18px;
      }

      .metric strong {
        display: block;
        font-size: 2.4rem;
      }

      .metric span,
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
        .hero,
        .card-grid,
        .value-grid {
          grid-template-columns: 1fr;
        }

        .hero-copy {
          padding: 28px;
        }
      }
    `
  ]
})
export class EventsHomeComponent {
  private readonly events = inject(EventService);
  readonly featuredEvents$ = this.events.getFeaturedEvents().pipe(map((items) => items.slice(0, 3)));
}
