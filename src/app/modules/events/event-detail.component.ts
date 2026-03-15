import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { EventService } from '../../core/services/event.service';
import { ImageFallbackDirective } from '../../shared/directives/image-fallback.directive';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, RouterLink, ImageFallbackDirective, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="page-shell detail-shell" *ngIf="event$ | async as event">
      <div class="detail-hero">
        <img [src]="event.image" [alt]="event.name" appImageFallback />
        <div class="hero-copy panel-surface">
          <p class="eyebrow">{{ event.category }} · {{ event.city }}</p>
          <h1>{{ event.name }}</h1>
          <p>{{ event.description }}</p>
          <div class="detail-meta">
            <span>{{ event.date | date: 'EEEE, d MMMM y' }}</span>
            <span>{{ event.time }}</span>
            <span>{{ event.venueName }}</span>
          </div>
          <div class="detail-actions">
            <a mat-flat-button [routerLink]="['/booking', event.id, 'seats']">Seleccionar asiento</a>
            <a mat-stroked-button routerLink="/events">Volver al catalogo</a>
          </div>
        </div>
      </div>

      <div class="detail-grid">
        <article class="panel-surface">
          <h2>Informacion del evento</h2>
          <p>{{ event.shortDescription }}</p>
          <p><strong>Ubicacion:</strong> {{ event.location }}</p>
          <p><strong>Direccion:</strong> {{ event.address }}</p>
          <mat-chip-set>
            <mat-chip *ngFor="let tag of event.tags">{{ tag }}</mat-chip>
          </mat-chip-set>
        </article>

        <article class="panel-surface">
          <h2>Precios por localidad</h2>
          <div class="tier-list">
            <div class="tier-item" *ngFor="let tier of event.priceTiers">
              <div>
                <strong>{{ tier.name }}</strong>
                <p>{{ tier.description }}</p>
              </div>
              <div class="tier-price">
                <span>{{ tier.price | currencyGtq }}</span>
                <small>{{ tier.availability }}</small>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [
    `
      .detail-shell {
        padding-top: 24px;
      }

      .detail-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
        gap: 24px;
      }

      .detail-hero img {
        width: 100%;
        min-height: 420px;
        object-fit: cover;
        border-radius: 32px;
      }

      .hero-copy {
        display: grid;
        gap: 18px;
      }

      .detail-meta,
      .detail-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        margin-top: 24px;
      }

      .tier-list {
        display: grid;
        gap: 14px;
      }

      .tier-item {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 0;
        border-bottom: 1px solid rgba(8, 15, 30, 0.08);
      }

      .tier-item p {
        margin: 4px 0 0;
        color: var(--text-muted);
      }

      .tier-price {
        text-align: right;
      }

      .tier-price span {
        display: block;
      }

      @media (max-width: 1024px) {
        .detail-hero,
        .detail-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class EventDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly events = inject(EventService);
  readonly event$ = this.route.paramMap.pipe(switchMap((params) => this.events.getEventById(params.get('id') ?? '')));
}
