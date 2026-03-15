import { CurrencyPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyGtq',
  standalone: true
})
export class CurrencyGtqPipe implements PipeTransform {
  private readonly currencyPipe = new CurrencyPipe('es-GT');

  transform(value: number | null | undefined): string {
    return this.currencyPipe.transform(value ?? 0, 'GTQ', 'symbol-narrow', '1.0-0') ?? 'Q0';
  }
}
