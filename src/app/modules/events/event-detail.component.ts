import { Component } from '@angular/core';
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
      <button routerLink="/booking">Seleccionar asiento</button>
    </section>
  `
})
export class EventDetailComponent {
  constructor(private route: ActivatedRoute) {}
}
