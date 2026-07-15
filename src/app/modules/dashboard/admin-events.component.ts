import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { EventItem, EventPriceTier } from '../../core/models/event.model';
import { Venue } from '../../core/models/venue.model';
import { EventAdminInput, EventService } from '../../core/services/event.service';
import { VenueService } from '../../core/services/venue.service';
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
              <p>Completa los campos requeridos para publicar el evento.</p>
            </div>
            <span class="status-chip">{{ form.controls.status.value }}</span>
          </div>

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
              <mat-label>Recinto</mat-label>
              <mat-select formControlName="venueId" (selectionChange)="onVenueSelectionChange()">
                @for (venue of venues; track venue.id) {
                  <mat-option [value]="venue.id.toString()">{{ venue.name }}</mat-option>
                }
              </mat-select>
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
              <mat-label>Estado</mat-label>
              <mat-select formControlName="status">
                <mat-option value="draft">Borrador</mat-option>
                <mat-option value="on-sale">Publicado</mat-option>
                <mat-option value="low-stock">Baja disponibilidad</mat-option>
                <mat-option value="sold-out">Agotado</mat-option>
              </mat-select>
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
              <mat-label>Localidades</mat-label>
              <input matInput formControlName="tiersText" placeholder="General:150, VIP:350" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Etiquetas</mat-label>
              <input matInput formControlName="tagsText" placeholder="Live, Weekend" />
            </mat-form-field>
          </div>

          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit">
              <mat-icon>save</mat-icon>
              {{ editingEvent ? 'Guardar cambios' : 'Crear evento' }}
            </button>
            <button mat-stroked-button type="button" (click)="resetForm()">Limpiar</button>
          </div>
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
                <p>{{ event.date | date: 'd MMM y' }} Â· {{ event.time }} Â· {{ event.venueName }}</p>
                <div class="event-meta">
                  <span>{{ event.metrics.ticketsLeft }} entradas</span>
                  <span>{{ event.basePrice | currencyGtq }}</span>
                  <span>{{ event.priceTiers.length }} localidades</span>
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
      grid-template-columns: minmax(360px, 480px) minmax(0, 1fr);
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

    .image-upload { display: grid; gap: 8px; color: var(--text-muted); font-size: .82rem; }
    .image-upload input { display: none; }
    .image-upload img { width: 100%; height: 120px; object-fit: cover; border-radius: 10px; }

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

    @media (max-width: 1100px) {
      .event-admin-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 720px) {
      .form-grid,
      .event-row {
        grid-template-columns: 1fr;
      }

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

  readonly form = this.fb.group({
    name: ['', Validators.required],
    category: ['Concert', Validators.required],
    city: ['Guatemala City', Validators.required],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    time: ['19:00', Validators.required],
    location: ['', Validators.required],
    venueId: ['', Validators.required],
    venueName: ['', Validators.required],
    address: ['', Validators.required],
    description: ['', Validators.required],
    basePrice: [150, [Validators.required, Validators.min(0)]],
    capacity: [100, [Validators.required, Validators.min(1)]],
    status: ['draft' as EventItem['status'], Validators.required],
    image: [''],
    tiersText: ['General:150'],
    tagsText: ['Live'],
    bannerColor: ['#004489'],
    shortDescription: [''],
    interested: [0]
  });

  ngOnInit(): void {
    this.events.getEvents().subscribe();
    this.venueService.getVenues(true).subscribe((venues) => {
      this.venues = venues;
      if (!this.form.controls.venueId.value && venues.length > 0) {
        this.form.patchValue({ venueId: venues[0].id.toString() });
        this.onVenueSelectionChange();
      }
    });
  }

  saveEvent(): void {
    if (this.form.invalid || (!this.editingEvent && !this.selectedImage)) {
      this.form.markAllAsTouched();
      return;
    }

    const input = this.toAdminInput();
    const request$ = this.editingEvent
      ? this.events.updateEvent(this.editingEvent.id, input)
      : this.events.createEvent(input);

    request$.subscribe(() => this.resetForm());
  }

  editEvent(event: EventItem): void {
    this.editingEvent = event;
    this.selectedImage = null;
    this.imagePreview = event.image;
    const date = new Date(event.date);
    this.form.patchValue({
      name: event.name,
      category: event.category,
      city: event.city,
      date: date.toISOString().slice(0, 10),
      time: event.time,
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
      interested: event.metrics.interested
    });
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
    this.selectedImage = null;
    this.imagePreview = '';
    this.form.reset({
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
      status: 'draft',
      image: '',
      tiersText: 'General:150',
      tagsText: 'Live',
      bannerColor: '#004489',
      shortDescription: '',
      interested: 0
    });
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

    return {
      ...raw,
      imageFile: this.selectedImage,
      tags: this.parseTags(raw.tagsText),
      priceTiers: this.parsePriceTiers(raw.tiersText, raw.basePrice)
    };
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

