import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dashboard-tickets',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Mis tickets</h2>
    <p>Lista de tickets y opciones para descargar/mostrar QR.</p>
  `
})
export class TicketsComponent {}
