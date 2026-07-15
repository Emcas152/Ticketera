import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Venue, VenueInput } from '../../core/models/venue.model';
import { VenueService } from '../../core/services/venue.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';

@Component({
  selector: 'app-venues',
  standalone: true,
  imports: [CommonModule, AsyncPipe, ReactiveFormsModule, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell venue-admin">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Configuracion</p>
          <h1>Venues</h1>
          <p class="admin-subtitle">Crea, modifica, activa o desactiva recintos disponibles.</p>
        </div>
        <button mat-stroked-button type="button" (click)="resetForm()">
          <mat-icon>add</mat-icon>
          Nuevo venue
        </button>
      </div>

      <div class="venue-admin-grid">
        <form class="panel-surface venue-form" [formGroup]="form" (ngSubmit)="saveVenue()">
          <div class="form-title">
            <div>
              <strong>{{ editingVenue ? 'Editar venue' : 'Crear venue' }}</strong>
              <p>Los venues activos se pueden usar para eventos y mapas.</p>
            </div>
            <span class="status-chip" [class.inactive]="form.controls.status.value === 'inactive'">
              {{ form.controls.status.value === 'active' ? 'Activo' : 'Inactivo' }}
            </span>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Nombre</mat-label>
            <input matInput formControlName="name" placeholder="Ej: Cafe Escenario" />
            <mat-icon matSuffix>location_on</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Direccion</mat-label>
            <input matInput formControlName="address" />
          </mat-form-field>

          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Ciudad</mat-label>
              <input matInput formControlName="city" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Pais</mat-label>
              <input matInput formControlName="country" maxlength="2" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="status">
                <mat-option value="active">Activo</mat-option>
                <mat-option value="inactive">Inactivo</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit">
              <mat-icon>save</mat-icon>
              {{ editingVenue ? 'Guardar cambios' : 'Crear venue' }}
            </button>
            <button mat-stroked-button type="button" (click)="resetForm()">Limpiar</button>
          </div>
        </form>

        <article class="panel-surface venue-list">
          <div class="list-head">
            <strong>Venues registrados</strong>
            <span>{{ (venues$ | async)?.length ?? 0 }} venues</span>
          </div>

          @for (venue of (venues$ | async) ?? []; track venue.id) {
            <div class="venue-row">
              <div class="venue-icon">
                <mat-icon>location_on</mat-icon>
              </div>
              <div class="venue-main">
                <div class="venue-row-head">
                  <strong>{{ venue.name }}</strong>
                  <span class="status-pill" [class.inactive]="venue.status === 'inactive'">
                    {{ venue.status === 'active' ? 'Activo' : 'Inactivo' }}
                  </span>
                </div>
                <p>{{ venue.address || 'Sin direccion' }} · {{ venue.city || 'Sin ciudad' }}, {{ venue.country }}</p>
                <div class="venue-meta">
                  <span>ID {{ venue.id }}</span>
                </div>
              </div>
              <div class="row-actions">
                <button mat-icon-button type="button" matTooltip="Editar" (click)="editVenue(venue)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  [matTooltip]="venue.status === 'active' ? 'Desactivar' : 'Activar'"
                  (click)="toggleVenue(venue)"
                >
                  <mat-icon>{{ venue.status === 'active' ? 'toggle_off' : 'toggle_on' }}</mat-icon>
                </button>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <mat-icon>location_off</mat-icon>
              <p>No hay venues registrados.</p>
            </div>
          }
        </article>
      </div>
    </section>
  `,
  styles: [`
    .venue-admin-grid{display:grid;grid-template-columns:minmax(340px,460px) minmax(0,1fr);gap:20px;align-items:start}.venue-form,.venue-list{display:grid;gap:16px}.form-title,.list-head,.venue-row-head,.venue-meta,.form-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}.form-title p,.list-head span,.venue-main p,.venue-meta{margin:4px 0 0;color:var(--text-muted)}.status-chip,.status-pill{padding:6px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:.72rem;font-weight:800;text-transform:uppercase}.status-chip.inactive,.status-pill.inactive{background:#fee2e2;color:#991b1b}.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.venue-row{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px;border:1px solid var(--surface-border);border-radius:14px;background:#fff}.venue-icon{display:grid;place-items:center;width:54px;height:54px;border-radius:12px;background:#eef5ff;color:var(--brand-primary)}.venue-main{min-width:0}.venue-meta{justify-content:flex-start;flex-wrap:wrap;font-size:.82rem}.row-actions{display:flex;align-items:center;gap:2px}.empty-state{display:grid;place-items:center;gap:8px;min-height:180px;color:var(--text-muted);border:1px dashed var(--surface-border);border-radius:14px;background:#fff}.empty-state p{margin:0}@media(max-width:1100px){.venue-admin-grid{grid-template-columns:1fr}}@media(max-width:720px){.form-grid,.venue-row{grid-template-columns:1fr}.row-actions{justify-content:flex-start}}
  `]
})
export class VenuesComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly venues = inject(VenueService);

  readonly venues$: Observable<Venue[]> = this.venues.venues$;
  editingVenue: Venue | null = null;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    address: [''],
    city: ['Guatemala City'],
    country: ['GT', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    status: ['active' as VenueInput['status'], Validators.required]
  });

  ngOnInit(): void {
    this.loadVenues();
  }

  saveVenue(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const input = this.form.getRawValue();
    const request$ = this.editingVenue
      ? this.venues.updateVenue(this.editingVenue.id, input)
      : this.venues.createVenue(input);

    request$.subscribe(() => {
      this.resetForm();
      this.loadVenues();
    });
  }

  editVenue(venue: Venue): void {
    this.editingVenue = venue;
    this.form.patchValue({
      name: venue.name,
      address: venue.address,
      city: venue.city,
      country: venue.country,
      status: venue.status
    });
  }

  toggleVenue(venue: Venue): void {
    const request$ = venue.status === 'active'
      ? this.venues.deactivateVenue(venue.id)
      : this.venues.activateVenue(venue.id);

    request$.subscribe(() => this.loadVenues());
  }

  resetForm(): void {
    this.editingVenue = null;
    this.form.reset({
      name: '',
      address: '',
      city: 'Guatemala City',
      country: 'GT',
      status: 'active'
    });
  }

  private loadVenues(): void {
    this.venues.getVenues().subscribe();
  }
}
