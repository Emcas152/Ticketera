import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Seat } from '../../core/models/seat.model';

@Component({
  selector: 'seat-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h2>Seleccionar asientos</h2>
    <div class="stage">ESCENARIO</div>
    <div class="rows">
      <div class="row" *ngFor="let row of rows">
        <div class="seat" *ngFor="let s of row" [class.selected]="s.status==='selected'" [class.sold]="s.status==='sold'" (click)="toggle(s)">{{s.row}}{{s.number}}</div>
      </div>
    </div>
  `,
  styles: [`.stage{text-align:center;padding:8px;background:#222;color:#fff;margin-bottom:12px}.rows{display:flex;flex-direction:column;gap:6px}.row{display:flex;gap:6px}.seat{padding:8px 10px;border:1px solid #ddd;border-radius:4px;cursor:pointer}.seat.selected{background:#2b8aef;color:#fff}.seat.sold{background:#ccc;cursor:not-allowed}`]
})
export class SeatMapComponent {
  rows: Seat[][] = [];
  constructor() {
    // build simple mock seatmap
    for (let r = 0; r < 6; r++) {
      const row: Seat[] = [];
      for (let n = 1; n <= 8; n++) {
        row.push({ id: `${r}-${n}`, row: String.fromCharCode(65 + r), number: n, price: 20 + r * 5, status: Math.random() > 0.9 ? 'sold' : 'available' });
      }
      this.rows.push(row);
    }
  }

  toggle(s: Seat) {
    if (s.status === 'sold') return;
    s.status = s.status === 'selected' ? 'available' : 'selected';
  }
}
