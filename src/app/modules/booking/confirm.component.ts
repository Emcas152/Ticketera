import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'booking-confirm',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Confirmación</h2>
    <p>Reserva confirmada (mock). Mostrar QR y detalles aquí.</p>
  `
})
export class ConfirmComponent {}
