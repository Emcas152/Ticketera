import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, catchError, concatMap, finalize, from, map, of, switchMap, toArray } from 'rxjs';
import { EventItem, EventPriceTier } from '../../core/models/event.model';
import { Venue } from '../../core/models/venue.model';
import { EventAdminInput, EventService } from '../../core/services/event.service';
import { CourtesyLimit, CourtesyLimitService } from '../../core/services/courtesy-limit.service';
import { VenueSection, VenueService } from '../../core/services/venue.service';
import { MATERIAL_IMPORTS } from '../../shared/material/material-imports';
import { CurrencyGtqPipe } from '../../shared/pipes/currency-gtq.pipe';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, AsyncPipe, DatePipe, ReactiveFormsModule, CurrencyGtqPipe, ...MATERIAL_IMPORTS],
  template: `
    <section class="admin-shell event-admin">
      <div class="admin-header">
        <div>
          <p class="eyebrow">Gestion de eventos</p>
          <h1>Eventos</h1>
          <p class="admin-subtitle">Crea, edita, elimina y publica eventos operativos.</p>
        </div>
        <button mat-stroked-button type="button" (click)="resetForm()">
          <mat-icon>add</mat-icon>
          Nuevo evento
        </button>
      </div>

      <div class="event-admin-grid">
        <form class="panel-surface event-form" [formGroup]="form" (ngSubmit)="saveEvent()">
          <div class="form-title">
            <div>
              <strong>{{ editingEvent ? 'Editar evento' : 'Crear evento' }}</strong>
              <p>{{ editingEvent ? 'Actualiza los datos del evento.' : 'Completa el flujo operativo en orden.' }}</p>
            </div>
            <span class="status-chip">{{ form.controls.status.value }}</span>
          </div>

          <mat-stepper [linear]="!editingEvent" orientation="vertical">
            <mat-step [completed]="venueStepValid">
              <ng-template matStepLabel>1. Ubicación</ng-template>
              <div class="step-content">
                <mat-form-field appearance="outline">
                  <mat-label>Origen del venue</mat-label>
                  <mat-select formControlName="venueMode" (selectionChange)="onVenueModeChange()">
                    <mat-option value="existing">Usar venue existente</mat-option>
                    <mat-option value="new">Crear venue nuevo</mat-option>
                  </mat-select>
                </mat-form-field>

                @if (form.controls.venueMode.value === 'existing') {
                  <mat-form-field appearance="outline">
                    <mat-label>Venue existente</mat-label>
                    <mat-select formControlName="venueId" (selectionChange)="onVenueSelectionChange()">
                      @for (venue of venues; track venue.id) {
                        <mat-option [value]="venue.id.toString()">{{ venue.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <p class="step-note"><mat-icon>lock</mat-icon> Se reutilizarán sus secciones y asientos sin modificarlos.</p>
                } @else {
                  <div class="form-grid">
                    <mat-form-field appearance="outline"><mat-label>Nombre del venue</mat-label><input matInput formControlName="newVenueName" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Dirección</mat-label><input matInput formControlName="newVenueAddress" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Ciudad</mat-label><input matInput formControlName="newVenueCity" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>País</mat-label><input matInput maxlength="2" formControlName="newVenueCountry" /></mat-form-field>
                  </div>
                }
                <div class="step-actions"><button mat-flat-button type="button" matStepperNext [disabled]="!venueStepValid">Continuar</button></div>
              </div>
            </mat-step>

            <mat-step [completed]="sectionsStepValid">
              <ng-template matStepLabel>2. Secciones, mesas y asientos</ng-template>
              <div class="step-content">
                @if (form.controls.venueMode.value === 'existing') {
                  <p class="step-note"><mat-icon>check_circle</mat-icon> {{ sectionControls.length }} secciones cargadas desde el venue existente.</p>
                } @else {
                  <p class="step-note"><mat-icon>auto_awesome</mat-icon> Configura la distribución de mesas para generar el plano de asientos automáticamente.</p>
                }
                <div formArrayName="sections" class="section-editor">
                  @for (section of sectionControls; track $index; let index = $index) {
                    <div class="section-card" [formGroupName]="index">
                      <div class="section-card-header">
                        <div class="section-header-title">
                          <span class="section-badge">{{ index + 1 }}</span>
                          <strong>{{ section.get('name')?.value || 'Nueva Sección' }}</strong>
                        </div>
                        <span class="calc-badge">
                          {{ (section.get('tablesCount')?.value || 0) * (section.get('seatsPerTable')?.value || 0) }} asientos totales
                          ({{ section.get('tablesCount')?.value || 0 }} mesas · {{ section.get('seatsPerTable')?.value || 0 }} asientos/mesa)
                        </span>
                        <button class="delete-section" mat-icon-button type="button" aria-label="Eliminar sección" matTooltip="Eliminar sección" (click)="removeSection(index)"><mat-icon>delete_outline</mat-icon></button>
                      </div>

                      <div class="section-card-grid">
                        <mat-form-field appearance="outline"><mat-label>Nombre</mat-label><input matInput formControlName="name" placeholder="Ej: Diamante, VIP, General" /></mat-form-field>
                        <mat-form-field appearance="outline"><mat-label>Código</mat-label><input matInput formControlName="code" placeholder="Ej: VIP" /></mat-form-field>
                        <mat-form-field appearance="outline"><mat-label>Total de mesas</mat-label><input matInput type="number" min="1" formControlName="tablesCount" /></mat-form-field>
                        <mat-form-field appearance="outline"><mat-label>Mesas por fila</mat-label><input matInput type="number" min="1" formControlName="tablesPerRow" /></mat-form-field>
                        <mat-form-field appearance="outline"><mat-label>Asientos por mesa</mat-label><input matInput type="number" min="1" formControlName="seatsPerTable" /></mat-form-field>
                        <mat-form-field appearance="outline"><mat-label>Precio</mat-label><span matTextPrefix>Q&nbsp;</span><input matInput type="number" min="0" formControlName="price" /></mat-form-field>
                      </div>
                    </div>
                  } @empty {
                    <p class="step-note warning"><mat-icon>warning</mat-icon> No hay secciones agregadas.</p>
                  }
                </div>
                <button mat-stroked-button type="button" (click)="addSection()"><mat-icon>add</mat-icon> Agregar sección</button>
                <div class="step-actions"><button mat-button type="button" matStepperPrevious>Atrás</button><button mat-flat-button type="button" matStepperNext [disabled]="!sectionsStepValid">Continuar</button></div>
              </div>
            </mat-step>

            <mat-step>
              <ng-template matStepLabel>3. Evento y preventa</ng-template>
              <div class="step-content">
                <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="name" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Categoria</mat-label>
              <mat-select formControlName="category">
                @for (category of categories; track category.value) {
                  <mat-option [value]="category.value">{{ category.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha</mat-label>
              <input matInput type="date" formControlName="date" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Hora</mat-label>
              <input matInput type="time" formControlName="time" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Ubicacion</mat-label>
              <input matInput formControlName="location" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Ciudad</mat-label>
              <input matInput formControlName="city" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Direccion</mat-label>
              <input matInput formControlName="address" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Precio base</mat-label>
              <input matInput type="number" min="0" formControlName="basePrice" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Capacidad</mat-label>
              <input matInput type="number" min="1" formControlName="capacity" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cortesías permitidas</mat-label>
              <input matInput type="number" min="0" formControlName="courtesyLimit" />
              <mat-hint>Cupo máximo para este evento</mat-hint>
              @if (form.controls.courtesyLimit.hasError('min')) { <mat-error>El cupo no puede ser negativo.</mat-error> }
              @if (form.controls.courtesyLimit.hasError('belowUsed')) { <mat-error>No puede ser menor que las cortesías usadas.</mat-error> }
            </mat-form-field>

            @if (editingEvent && courtesyLimit) {
              <div class="courtesy-summary">
                <span>Usadas <strong>{{ courtesyLimit.used }}</strong></span>
                <span>Disponibles <strong>{{ courtesyAvailable }}</strong></span>
              </div>
            }

            <mat-form-field appearance="outline">
              <mat-label>Estado</mat-label>
              <mat-select formControlName="status">
                <mat-option value="draft">Borrador</mat-option>
                <mat-option value="on-sale">Publicado</mat-option>
                <mat-option value="low-stock">Baja disponibilidad</mat-option>
                <mat-option value="sold-out">Agotado</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Inicio de preventa</mat-label>
              <input matInput type="datetime-local" formControlName="presaleStartsAt" />
            </mat-form-field>

            <div class="image-upload">
              <span>Imagen del evento{{ editingEvent ? '' : '*' }}</span>
              <input #imageInput type="file" accept="image/jpeg,image/png,image/webp" (change)="onImageSelected($event)" />
              <button mat-stroked-button type="button" (click)="imageInput.click()">
                <mat-icon>upload</mat-icon>
                {{ selectedImage ? selectedImage.name : 'Seleccionar archivo' }}
              </button>
              <small>JPG, PNG o WebP. Maximo 5 MB.</small>
              @if (imagePreview) { <img [src]="imagePreview" alt="Vista previa del evento" /> }
            </div>
                </div>

          <mat-form-field appearance="outline">
            <mat-label>Descripcion</mat-label>
            <textarea matInput rows="3" formControlName="description"></textarea>
          </mat-form-field>

          <div class="form-grid compact">
            <mat-form-field appearance="outline">
              <mat-label>Etiquetas</mat-label>
              <input matInput formControlName="tagsText" placeholder="Live, Weekend" />
            </mat-form-field>
          </div>

          <div class="form-actions">
            <button mat-button type="button" matStepperPrevious>Atrás</button>
            <button mat-flat-button color="primary" type="submit" [disabled]="saving">
              <mat-icon>save</mat-icon>
              {{ saving ? 'Creando flujo...' : (editingEvent ? 'Guardar cambios' : 'Crear evento completo') }}
            </button>
            <button mat-stroked-button type="button" (click)="resetForm()">Limpiar</button>
          </div>
              </div>
            </mat-step>
          </mat-stepper>
        </form>

        <article class="panel-surface event-list">
          <div class="list-head">
            <strong>Eventos registrados</strong>
            <span>{{ (events$ | async)?.length ?? 0 }} eventos</span>
          </div>

          @for (event of (events$ | async) ?? []; track event.id) {
            <div class="event-row">
              <img [src]="event.image" [alt]="event.name" />
              <div class="event-main">
                <div class="event-row-head">
                  <strong>{{ event.name }}</strong>
                  <span class="status-pill" [class]="event.status">{{ statusLabel(event) }}</span>
                </div>
                <p>{{ event.date | date: 'd MMM y' }} &middot; {{ event.time }} &middot; {{ event.venueName }}</p>
                <div class="event-meta">
                  <span>{{ event.metrics.ticketsLeft }} entradas</span>
                  <span>{{ event.basePrice | currencyGtq }}</span>
                  <span>{{ event.priceTiers.length }} localidades</span>
                  @if (courtesyLimits[event.id]; as courtesy) {
                    <span>{{ courtesy.used }}/{{ courtesy.maximum }} cortesías · {{ courtesy.available }} disponibles</span>
                  }
                </div>
              </div>
              <div class="row-actions">
                <button mat-icon-button type="button" matTooltip="Editar" (click)="editEvent(event)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" matTooltip="Publicar" (click)="publishEvent(event)" [disabled]="event.status === 'on-sale'">
                  <mat-icon>campaign</mat-icon>
                </button>
                <button mat-icon-button type="button" matTooltip="Eliminar" (click)="deleteEvent(event)">
                  <mat-icon>delete_outline</mat-icon>
                </button>
              </div>
            </div>
          }
        </article>
      </div>
    </section>
  `,
  styles: [`
    .event-admin-grid {
      display: grid;
      grid-template-columns: minmax(620px, 690px) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }

    .event-form,
    .event-list {
      display: grid;
      gap: 16px;
    }

    .form-title,
    .list-head,
    .event-row-head,
    .event-meta,
    .form-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .form-title p,
    .list-head span,
    .event-main p,
    .event-meta {
      margin: 4px 0 0;
      color: var(--text-muted);
    }

    .status-chip {
      padding: 6px 10px;
      border-radius: 999px;
      background: #eef2f7;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .form-grid.compact {
      grid-template-columns: 1fr;
    }

    .step-content { display: grid; gap: 14px; padding: 14px 0 8px; }
    .step-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .step-note { display: flex; align-items: center; gap: 8px; margin: 0; color: var(--text-muted); font-size: .84rem; }
    .step-note mat-icon { width: 18px; height: 18px; font-size: 18px; }
    .step-note.warning { color: #9a6700; }
    .section-editor { display: grid; gap: 14px; }
    .section-card {
      padding: 14px 16px; border: 1px solid #dbe3ee; border-radius: 14px; background: #fff;
      box-shadow: 0 2px 10px rgba(15,23,42,.04); display: grid; gap: 12px; transition: border-color .15s;
    }
    .section-card:focus-within { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,.08); }
    .section-card-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .section-header-title { display: flex; align-items: center; gap: 10px; }
    .section-badge {
      display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
      background: #e8f1ff; color: #0759b8; font-size: .76rem; font-weight: 800;
    }
    .calc-badge {
      font-size: 0.74rem; font-weight: 700; color: #0369a1; background: #f0f9ff;
      border: 1px solid #bae6fd; padding: 3px 10px; border-radius: 999px;
    }
    .section-card-grid {
      display: grid; grid-template-columns: 1.8fr 1fr 1fr 1fr 1fr 1.2fr; gap: 10px; align-items: center;
    }
    .section-card-grid mat-form-field { min-width: 0; }
    @media (max-width: 900px) {
      .section-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 500px) {
      .section-card-grid { grid-template-columns: 1fr; }
    }

    .image-upload { display: grid; gap: 8px; color: var(--text-muted); font-size: .82rem; }
    .image-upload input { display: none; }
    .image-upload img { width: 100%; height: 120px; object-fit: cover; border-radius: 10px; }
    .courtesy-summary{display:flex;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid #a7f3d0;border-radius:10px;background:#ecfdf5;color:#065f46}.courtesy-summary span{display:grid;gap:2px;font-size:.76rem}.courtesy-summary strong{font-size:1.15rem}

    .event-row {
      display: grid;
      grid-template-columns: 82px minmax(0, 1fr) auto;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border: 1px solid var(--surface-border);
      border-radius: 14px;
      background: #fff;
    }

    .event-row img {
      width: 82px;
      height: 68px;
      object-fit: cover;
      border-radius: 10px;
    }

    .event-main {
      min-width: 0;
    }

    .event-meta {
      justify-content: flex-start;
      flex-wrap: wrap;
      font-size: 0.82rem;
    }

    .row-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    @media (max-width: 1350px) {
      .event-admin-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .form-grid,
      .event-row {
        grid-template-columns: 1fr;
      }

      .section-row{grid-template-columns:32px 1fr 1fr 40px}.section-index{grid-row:1/4}.name-field{grid-column:2/4}.code-field{grid-column:2}.rows-field{grid-column:3}.seats-field{grid-column:2}.price-field{grid-column:3}.delete-section{grid-column:4;grid-row:1}

      .row-actions {
        justify-content: flex-start;
      }
    }
  `]
})
export class AdminEventsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly events = inject(EventService);
  private readonly venueService = inject(VenueService);
  private readonly courtesyLimitsService = inject(CourtesyLimitService);

  readonly events$: Observable<EventItem[]> = this.events.events$;
  editingEvent: EventItem | null = null;
  venues: Venue[] = [];
  readonly categories = [
    { value: 'Concert', label: 'Concierto' },
    { value: 'Festival', label: 'Festival' },
    { value: 'Theater', label: 'Teatro' },
    { value: 'Comedy', label: 'Comedia' },
    { value: 'Sports', label: 'Deportes' },
    { value: 'Conference', label: 'Conferencia' },
    { value: 'Other', label: 'Otro' }
  ];
  selectedImage: File | null = null;
  imagePreview = '';
  saving = false;
  courtesyLimit: CourtesyLimit | null = null;
  readonly courtesyLimits: Record<string, CourtesyLimit> = {};

  readonly form = this.fb.group({
    venueMode: ['existing' as 'existing' | 'new'],
    newVenueName: [''],
    newVenueAddress: [''],
    newVenueCity: ['Guatemala City'],
    newVenueCountry: ['GT'],
    name: ['', Validators.required],
    category: ['Concert', Validators.required],
    city: ['Guatemala City', Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    time: ['19:00', Validators.required],
    location: ['', Validators.required],
    venueId: [''],
    venueName: ['', Validators.required],
    address: ['', Validators.required],
    description: ['', Validators.required],
    basePrice: [150, [Validators.required, Validators.min(0)]],
    capacity: [100, [Validators.required, Validators.min(1)]],
    courtesyLimit: [0, [Validators.required, Validators.min(0)]],
    status: ['draft' as EventItem['status'], Validators.required],
    image: [''],
    tiersText: ['General:150'],
    tagsText: ['Live'],
    bannerColor: ['#6a00ff'],
    shortDescription: [''],
    interested: [0],
    presaleStartsAt: [''],
    sections: this.fb.array([this.createSectionGroup()])
  });

  get sectionControls() { return this.form.controls.sections.controls; }
  get courtesyAvailable(): number {
    return Math.max(0, this.form.controls.courtesyLimit.value - (this.courtesyLimit?.used ?? 0));
  }

  get venueStepValid(): boolean {
    if (this.form.controls.venueMode.value === 'existing') return Boolean(this.form.controls.venueId.value);
    return Boolean(
      this.form.controls.newVenueName.value.trim() &&
      this.form.controls.newVenueAddress.value.trim() &&
      this.form.controls.newVenueCity.value.trim() &&
      this.form.controls.newVenueCountry.value.trim().length === 2
    );
  }

  get sectionsStepValid(): boolean {
    return this.sectionControls.length > 0 && this.form.controls.sections.valid;
  }

  ngOnInit(): void {
    this.events.getEvents().subscribe((events) => events.forEach((event) => this.loadCourtesyLimit(event.id)));
    this.venueService.getVenues(true).subscribe((venues) => {
      this.venues = venues;
      if (!this.form.controls.venueId.value && venues.length > 0) {
        this.form.patchValue({ venueId: venues[0].id.toString() });
        this.onVenueSelectionChange();
      }
    });
  }

  saveEvent(): void {
    if (this.courtesyLimit && this.form.controls.courtesyLimit.value < this.courtesyLimit.used) {
      this.form.controls.courtesyLimit.setErrors({ belowUsed: true });
    }
    if (this.form.invalid || !this.venueStepValid || !this.sectionsStepValid || (!this.editingEvent && !this.selectedImage)) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    const request$ = this.editingEvent
      ? this.events.updateEvent(this.editingEvent.id, this.toAdminInput())
      : this.createCompleteEvent();

    request$.pipe(
      switchMap((event) => this.courtesyLimitsService.save(event.id, this.form.controls.courtesyLimit.value, this.courtesyLimit?.id).pipe(map(() => event))),
      finalize(() => this.saving = false)
    ).subscribe(() => this.resetForm());
  }

  editEvent(event: EventItem): void {
    this.editingEvent = event;
    this.courtesyLimit = null;
    this.form.controls.courtesyLimit.setValue(0);
    this.loadCourtesyLimit(event.id, true);
    this.selectedImage = null;
    this.imagePreview = event.image;
    const localDate = this.events.getEventLocalParts(event.date);
    this.form.patchValue({
      name: event.name,
      category: event.category,
      city: event.city,
      date: localDate.date,
      time: localDate.time,
      location: event.location,
      venueId: this.findVenueIdByName(event.venueName),
      venueName: event.venueName,
      address: event.address,
      description: event.description,
      basePrice: event.basePrice,
      capacity: event.metrics.ticketsLeft,
      status: event.status,
      image: event.image,
      tiersText: event.priceTiers.map((tier) => `${tier.name}:${tier.price}`).join(', '),
      tagsText: event.tags.join(', '),
      bannerColor: event.bannerColor,
      shortDescription: event.shortDescription,
      interested: event.metrics.interested,
      presaleStartsAt: ''
    });
    this.onVenueSelectionChange();
  }

  publishEvent(event: EventItem): void {
    this.events.publishEvent(event.id).subscribe();
  }

  deleteEvent(event: EventItem): void {
    this.events.deleteEvent(event.id).subscribe(() => {
      if (this.editingEvent?.id === event.id) {
        this.resetForm();
      }
    });
  }

  resetForm(): void {
    this.editingEvent = null;
    this.courtesyLimit = null;
    this.selectedImage = null;
    this.imagePreview = '';
    this.form.reset({
      venueMode: 'existing',
      newVenueName: '',
      newVenueAddress: '',
      newVenueCity: 'Guatemala City',
      newVenueCountry: 'GT',
      name: '',
      category: 'Concert',
      city: 'Guatemala City',
      date: new Date().toISOString().slice(0, 10),
      time: '19:00',
      location: '',
      venueId: this.venues[0]?.id.toString() ?? '',
      venueName: '',
      address: '',
      description: '',
      basePrice: 150,
      capacity: 100,
      courtesyLimit: 0,
      status: 'draft',
      image: '',
      tiersText: 'General:150',
      tagsText: 'Live',
      bannerColor: '#6a00ff',
      shortDescription: '',
      interested: 0,
      presaleStartsAt: ''
    });
    this.form.controls.sections.clear();
    this.onVenueSelectionChange();
  }

  onVenueSelectionChange(): void {
    const venue = this.venues.find((item) => String(item.id) === String(this.form.controls.venueId.value));
    if (!venue) return;
    this.form.patchValue({
      venueName: venue.name,
      location: venue.name,
      city: venue.city || this.form.controls.city.value,
      address: venue.address || this.form.controls.address.value
    });
    this.loadVenueSections(venue.id);
  }

  onVenueModeChange(): void {
    this.form.controls.sections.clear();
    if (this.form.controls.venueMode.value === 'new') {
      this.form.patchValue({ venueId: '', venueName: '', location: '', address: '' });
      this.addSection();
      return;
    }
    if (this.venues.length > 0) {
      this.form.controls.venueId.setValue(String(this.venues[0].id));
      this.onVenueSelectionChange();
    }
  }

  addSection(section?: VenueSection): void {
    this.form.controls.sections.push(this.createSectionGroup(section));
  }

  removeSection(index: number): void {
    this.form.controls.sections.removeAt(index);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      input.value = '';
      return;
    }

    this.selectedImage = file;
    const reader = new FileReader();
    reader.onload = () => this.imagePreview = String(reader.result ?? '');
    reader.readAsDataURL(file);
  }

  statusLabel(event: EventItem): string {
    if (event.status === 'draft') return 'Borrador';
    if (event.status === 'low-stock') return 'Baja';
    if (event.status === 'sold-out') return 'Agotado';
    return 'Publicado';
  }

  private toAdminInput(): EventAdminInput {
    const raw = this.form.getRawValue();
    const calculatedCapacity = raw.sections.reduce(
      (sum, sec) => sum + (Number(sec.tablesCount) || 20) * (Number(sec.seatsPerTable) || 10),
      0
    );

    return {
      ...raw,
      capacity: raw.capacity && raw.capacity > 0 ? raw.capacity : (calculatedCapacity || 100),
      imageFile: this.selectedImage,
      tags: this.parseTags(raw.tagsText),
      priceTiers: raw.sections.map((section) => ({
        name: section.name,
        price: Number(section.price),
        description: `Localidad ${section.name}.`,
        availability: 'available' as const
      }))
    };
  }

  private createCompleteEvent(): Observable<EventItem> {
    if (this.form.controls.venueMode.value === 'existing') {
      return this.events.createEvent(this.toAdminInput());
    }

    const raw = this.form.getRawValue();
    const seatMapConfig = this.buildParqueStyleSeatMap(raw.sections);

    return this.venueService.createVenue({
      name: raw.newVenueName.trim(),
      address: raw.newVenueAddress.trim(),
      city: raw.newVenueCity.trim(),
      country: raw.newVenueCountry.trim().toUpperCase(),
      status: 'active'
    }).pipe(
      switchMap((venue) => {
        this.form.patchValue({
          venueId: String(venue.id),
          venueName: venue.name,
          location: venue.name,
          city: venue.city,
          address: venue.address
        });

        // 1. Guardar el plano de asientos completo generado automáticamente estilo Parque de la Industria
        return this.venueService.saveSeatMap(venue.id, seatMapConfig).pipe(
          catchError(() => of(null)),
          // 2. Crear las secciones en backend
          switchMap(() => from(raw.sections).pipe(
            concatMap((section) => this.venueService.createSection({
              venue_id: Number(venue.id),
              name: section.name.trim(),
              code: (section.code?.trim() || section.name.trim().slice(0, 4) || 'SEC').toUpperCase()
            }).pipe(
              catchError(() => of({ id: Math.floor(Math.random() * 1000), name: section.name, code: section.code })),
              map((created) => ({ created, source: section }))
            )),
            toArray()
          )),
          // 3. Generar asientos en backend para cada sección
          switchMap((sections) => from(sections).pipe(
            concatMap(({ created, source }) => {
              const rowCount = Math.ceil((Number(source.tablesCount) || 1) / (Number(source.tablesPerRow) || 20));
              const rowLetters = Array.from({ length: rowCount }, (_, i) => String.fromCharCode(65 + i)).join(',');
              const seatsPerRow = (Number(source.tablesPerRow) || 20) * (Number(source.seatsPerTable) || 10);

              return this.venueService.generateSeats({
                section_id: Number(created.id),
                rows: rowLetters,
                seats_per_row: seatsPerRow
              }).pipe(catchError(() => of(null)));
            }),
            toArray()
          )),
          // 4. Crear el evento final
          switchMap(() => this.events.createEvent(this.toAdminInput()))
        );
      })
    );
  }

  private buildParqueStyleSeatMap(rawSections: Array<{
    name: string;
    code: string;
    tablesCount: number;
    tablesPerRow: number;
    seatsPerTable: number;
    price: number;
  }>): {
    canvas_width: number;
    canvas_height: number;
    elements: unknown[];
    sections: unknown[];
    tables: unknown[];
    total_seats: number;
    total_tables: number;
  } {
    const CANVAS_W = 1900;
    const TABLE_W = 32;
    const TABLE_H = 78;
    const SEAT_OFFSET = 10;
    const SEAT_SPACING = 14;

    const sectionColors = ['#0b2c6b', '#e85d04', '#008c95', '#64748b', '#7c3aed', '#059669'];
    const zoneBgColors = ['#fef3c7', '#e0f2fe', '#dcfce7', '#f1f5f9', '#f3e8ff', '#ecfdf5'];

    const elements: unknown[] = [
      { id: 'stage', kind: 'stage', label: 'ESCENARIO', x: 460, y: 20, w: 980, h: 90, color: '#142238', textColor: '#fff7ed', rotation: 0 },
      { id: 'foh-zone', kind: 'zone', label: 'FOH', x: 830, y: 1970, w: 240, h: 80, color: '#e2e8f0', textColor: '#0f172a', rotation: 0 }
    ];

    const mappedSections: unknown[] = [];
    const tables: unknown[] = [];
    let globalTableNumber = 1;
    let currentY = 170;

    rawSections.forEach((sec, sIdx) => {
      const secColor = sectionColors[sIdx % sectionColors.length];
      const zoneBg = zoneBgColors[sIdx % zoneBgColors.length];
      const count = Math.max(1, Number(sec.tablesCount) || 1);
      const perRow = Math.max(1, Number(sec.tablesPerRow) || 20);
      const seatsCount = Math.max(1, Number(sec.seatsPerTable) || 10);
      const rowCount = Math.ceil(count / perRow);
      const sectionStartY = currentY;

      mappedSections.push({
        id: sec.code?.toLowerCase() || `sec-${sIdx + 1}`,
        name: sec.name,
        price: Number(sec.price) || 150,
        color: secColor,
        tableCount: count
      });

      elements.push({
        id: `zone-${sec.code?.toLowerCase() || sIdx}`,
        kind: 'zone',
        label: sec.name.toUpperCase(),
        x: 95,
        y: sectionStartY - 55,
        w: 1735,
        h: rowCount * 145 + 30,
        color: zoneBg,
        textColor: '#0f172a',
        rotation: 0
      });

      for (let i = 0; i < count; i++) {
        const rowInSec = Math.floor(i / perRow);
        const colInSec = i % perRow;
        const spacingX = perRow > 1 ? Math.min(95, 1600 / (perRow - 1)) : 95;
        const centerX = 150 + colInSec * spacingX;
        const centerY = sectionStartY + rowInSec * 145;

        const tableX = centerX - TABLE_W / 2;
        const tableY = centerY - TABLE_H / 2;

        const seats: Array<{ number: number; x: number; y: number }> = [];
        const seatsPerSide = Math.ceil(seatsCount / 2);

        for (let s = 1; s <= seatsCount; s++) {
          const onLeft = s <= seatsPerSide;
          const sideIndex = onLeft ? s - 1 : s - seatsPerSide - 1;
          const cx = onLeft ? -SEAT_OFFSET : TABLE_W + SEAT_OFFSET;
          const cy = 11 + sideIndex * SEAT_SPACING;
          seats.push({ number: s, x: cx, y: cy });
        }

        tables.push({
          id: `table-${globalTableNumber}`,
          label: String(globalTableNumber),
          section: sec.name,
          x: Math.round(tableX),
          y: Math.round(tableY),
          rotation: 0,
          seats
        });

        globalTableNumber++;
      }

      currentY = sectionStartY + rowCount * 145 + 80;
    });

    const canvasHeight = Math.max(2120, currentY + 120);
    const totalTables = tables.length;
    const totalSeats = rawSections.reduce((sum, s) => sum + (Number(s.tablesCount) || 0) * (Number(s.seatsPerTable) || 0), 0);

    return {
      canvas_width: CANVAS_W,
      canvas_height: canvasHeight,
      elements,
      sections: mappedSections,
      tables,
      total_seats: totalSeats,
      total_tables: totalTables
    };
  }

  private createSectionGroup(section?: VenueSection) {
    const defaultCode = section?.code?.trim()
      || (section?.name ? section.name.trim().slice(0, 4).toUpperCase() : 'VIP');

    const tierPrice = this.editingEvent
      ? this.editingEvent.priceTiers.find((tier) =>
          String(tier.sectionId ?? '') === String(section?.id ?? '')
          || tier.name.trim().toLowerCase() === (section?.name ?? '').trim().toLowerCase()
        )?.price
      : undefined;

    return this.fb.group({
      id: [section ? String(section.id) : ''],
      name: [section?.name ?? 'VIP', Validators.required],
      code: [defaultCode],
      tablesCount: [20, [Validators.required, Validators.min(1)]],
      tablesPerRow: [20, [Validators.required, Validators.min(1)]],
      seatsPerTable: [10, [Validators.required, Validators.min(1)]],
      price: [tierPrice ?? 150, [Validators.required, Validators.min(0)]]
    });
  }

  private loadVenueSections(venueId: number | string): void {
    this.venueService.getVenueSections(venueId).subscribe((sections) => {
      this.form.controls.sections.clear();
      sections.forEach((section) => this.addSection(section));
    });
  }

  private loadCourtesyLimit(eventId: string, applyToForm = false): void {
    this.courtesyLimitsService.getByEvent(eventId).subscribe({
      next: (limit) => {
        this.courtesyLimits[eventId] = limit;
        if (applyToForm && this.editingEvent?.id === eventId) {
          this.courtesyLimit = limit;
          this.form.controls.courtesyLimit.setValue(limit.maximum);
        }
      },
      error: (error: { status?: number }) => {
        if (error.status !== 404) return;
        const empty = { eventId, maximum: 0, used: 0, available: 0 };
        this.courtesyLimits[eventId] = empty;
        if (applyToForm && this.editingEvent?.id === eventId) this.courtesyLimit = empty;
      }
    });
  }

  private findVenueIdByName(venueName: string): string {
    return this.venues.find((venue) => venue.name === venueName)?.id.toString() ?? '';
  }

  private parseTags(value: string): string[] {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  private parsePriceTiers(value: string, fallbackPrice: number): EventPriceTier[] {
    return value
      .split(',')
      .map((item) => {
        const [name, price] = item.split(':').map((part) => part.trim());
        return {
          name: name || 'General',
          price: Number(price) || fallbackPrice,
          description: `Localidad ${name || 'General'}.`,
          availability: 'available' as const
        };
      })
      .filter((tier) => tier.name);
  }
}

