import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'event-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="detail">
      <h2>Detalle del evento</h2>
      <p>Información completa del evento (mock)</p>
      <div *ngIf="eventId">ID: {{ eventId }}</div>
      <button routerLink="/booking">Seleccionar asiento</button>
    </section>
  `
})
export class EventDetailComponent implements OnInit {
  eventId: string | null = null;
  constructor(private route: ActivatedRoute) {}
  ngOnInit() {
    this.route.queryParamMap.subscribe((m) => this.eventId = m.get('id'));
  }
}
