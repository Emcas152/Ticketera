import { DatePipe, NgClass } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventItem } from '../../../core/models/event.model';
import { ImageFallbackDirective } from '../../directives/image-fallback.directive';
import { MATERIAL_IMPORTS } from '../../material/material-imports';
import { CurrencyGtqPipe } from '../../pipes/currency-gtq.pipe';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [RouterLink, DatePipe, NgClass, ImageFallbackDirective, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <mat-card class="event-card">
      <div class="media">
        <img [src]="event.image" [alt]="event.name" appImageFallback />
        <div class="media-overlay" [style.background]="overlay"></div>
        <mat-chip-set class="chip-row">
          <mat-chip>{{ event.category }}</mat-chip>
          <mat-chip [ngClass]="event.status">{{ event.status }}</mat-chip>
        </mat-chip-set>
      </div>

      <mat-card-content>
        <div class="meta-top">
          <p>{{ event.date | date: 'EEE, d MMM' }}</p>
          <span>{{ event.city }}</span>
        </div>
        <h3>{{ event.name }}</h3>
        <p class="description">{{ event.shortDescription }}</p>
        <div class="detail-line">{{ event.venueName }} · {{ event.location }}</div>
        <div class="detail-line">Desde {{ event.basePrice | currencyGtq }}</div>
      </mat-card-content>

      <mat-card-actions align="end">
        <a mat-button [routerLink]="['/events', event.id]">Detalle</a>
        <a mat-flat-button [routerLink]="['/booking', event.id, 'seats']">Comprar</a>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
      .event-card {
        overflow: hidden;
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.86);
      }

      .media {
        position: relative;
        height: 220px;
      }

      .media img,
      .media-overlay {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .media img {
        object-fit: cover;
      }

      .media-overlay {
        opacity: 0.6;
      }

      .chip-row {
        position: absolute;
        top: 16px;
        left: 16px;
      }

      .meta-top,
      .detail-line {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        color: var(--text-muted);
      }

      .meta-top p,
      .description {
        margin: 0;
      }

      h3 {
        margin: 12px 0 10px;
      }

      .description {
        min-height: 52px;
      }

      .on-sale {
        background: rgba(34, 197, 94, 0.18);
      }

      .low-stock {
        background: rgba(251, 146, 60, 0.18);
      }
    `
  ]
})
export class EventCardComponent {
  @Input({ required: true }) event!: EventItem;

  get overlay(): string {
    return `linear-gradient(160deg, ${this.event.bannerColor} 0%, rgba(7, 17, 27, 0.1) 100%)`;
  }
}
