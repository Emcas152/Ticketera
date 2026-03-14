import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EventItem } from '../../../core/models/event.model';

@Component({
  selector: 'app-event-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <article class="card">
      <img *ngIf="event.image" [src]="event.image" alt="{{ event.name }}" />
      <div class="body">
        <h3>{{ event.name }}</h3>
        <div class="meta">{{ event.date }} • {{ event.location }}</div>
        <div class="price">Desde ${{ event.basePrice }}</div>
        <a [routerLink]="['/event', event.id]">Ver detalle</a>
      </div>
    </article>
  `,
  styles: [`.card{display:flex;border:1px solid #eee;border-radius:6px;overflow:hidden}.card img{width:160px;height:110px;object-fit:cover}.card .body{padding:12px}.meta{color:#777;font-size:13px}.price{font-weight:600;margin-top:8px}`]
})
export class EventCardComponent { @Input() event!: EventItem }
