import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { EventFilters } from '../../../core/models/event.model';
import { MATERIAL_IMPORTS } from '../../material/material-imports';

@Component({
  selector: 'app-event-filters',
  standalone: true,
  imports: [ReactiveFormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="filters panel-surface" [formGroup]="form">
      <mat-form-field appearance="outline">
        <mat-label>Buscar evento</mat-label>
        <input matInput formControlName="query" placeholder="Nombre, venue o categoria" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Categoria</mat-label>
        <mat-select formControlName="category">
          <mat-option *ngFor="let category of categories" [value]="category">
            {{ category === 'all' ? 'Todas' : category }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Ciudad</mat-label>
        <mat-select formControlName="city">
          <mat-option *ngFor="let city of cities" [value]="city">
            {{ city === 'all' ? 'Todas' : city }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Fecha</mat-label>
        <mat-select formControlName="datePreset">
          <mat-option value="all">Cualquier fecha</mat-option>
          <mat-option value="today">Hoy</mat-option>
          <mat-option value="week">Esta semana</mat-option>
          <mat-option value="month">Este mes</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Precio</mat-label>
        <mat-select formControlName="priceRange">
          <mat-option value="all">Todos</mat-option>
          <mat-option value="budget">Hasta Q200</mat-option>
          <mat-option value="premium">Premium</mat-option>
        </mat-select>
      </mat-form-field>
    </section>
  `,
  styles: [
    `
      .filters {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 16px;
      }

      @media (max-width: 1100px) {
        .filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 768px) {
        .filters {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class EventFiltersComponent implements OnChanges {
  @Input() categories: string[] = [];
  @Input() cities: string[] = [];
  @Input() filters!: EventFilters;
  @Output() readonly filtersChange = new EventEmitter<EventFilters>();

  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    query: '',
    category: 'all',
    city: 'all',
    datePreset: 'all' as EventFilters['datePreset'],
    priceRange: 'all' as EventFilters['priceRange']
  });

  constructor() {
    this.form.valueChanges.pipe(debounceTime(250)).subscribe((value) => {
      this.filtersChange.emit(value as EventFilters);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters']?.currentValue) {
      this.form.patchValue(this.filters, { emitEvent: false });
    }
  }
}
