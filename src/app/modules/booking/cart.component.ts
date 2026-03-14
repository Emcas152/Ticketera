import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'booking-cart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Carrito</h2>
    <p>Asientos seleccionados (mock)</p>
    <button routerLink="/booking/confirm">Continuar</button>
  `
})
export class CartComponent {}
