import { Component } from '@angular/core';
import { CashSalesComponent } from './cash-sales.component';

@Component({
  selector: 'app-courtesy-seats',
  standalone: true,
  imports: [CashSalesComponent],
  template: `<app-cash-sales mode="courtesy" />`
})
export class CourtesySeatsComponent {}
