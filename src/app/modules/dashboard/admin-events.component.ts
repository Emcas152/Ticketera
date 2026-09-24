import { AsyncPipe, CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, catchError, concatMap, finalize, from, map, of, switchMap, toArray } from 'rxjs';
import { EventItem, EventPriceTier } from '../../core/models/event.model';
import { Venue } from '../../core/models/venue.model';
import { EventAdminInput, EventService } from '../../core/services/event.service';
import { CourtesyLimit, CourtesyLimitService } from '../../core/services/courtesy-limit.service';
import { VenueSection, VenueService } from '../../core/services/venue.service';
import { NotificationService } from '../../core/services/notification.service';
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
                @if (editingEvent) {
                  <div class="venue-locked-card">
                    <div class="venue-locked-header">
                      <mat-icon class="venue-icon">storefront</mat-icon>
                      <div class="venue-locked-details">
                        <strong>{{ form.controls.venueName.value || editingEvent.venueName }}</strong>
                        <p>{{ form.controls.address.value }} &middot; {{ form.controls.city.value }}</p>
                      </div>
                      <span class="locked-badge"><mat-icon>lock</mat-icon> Recinto fijo</span>
                    </div>
                    <p class="step-note"><mat-icon>info</mat-icon> El recinto y el plano de mesas no se pueden modificar al editar un evento.</p>
                  </div>
                } @else {
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
                }
                <div class="step-actions"><button mat-flat-button type="button" matStepperNext [disabled]="!venueStepValid" (click)="onVenueStepNext()">Continuar</button></div>
              </div>
            </mat-step>

            <mat-step [completed]="sectionsStepValid">
              <ng-template matStepLabel>{{ editingEvent ? '2. Precios y fees de localidades' : '2. Secciones y asientos' }}</ng-template>
              <div class="step-content">
                @if (editingEvent) {
                  <p class="step-note"><mat-icon>info</mat-icon> El mapa y la distribución de mesas están definidos por el recinto. Modifica únicamente el precio y el fee de servicio para cada localidad.</p>
                  <div formArrayName="sections" class="section-editor">
                    @for (section of sectionControls; track section; let index = $index) {
                      <div class="section-card edit-mode-card" [formGroupName]="index">
                        <div class="section-edit-header">
                          <div class="section-identity">
                            <span class="section-badge">{{ index + 1 }}</span>
                            <div class="section-title-wrap">
                              <strong class="section-name">{{ section.get('name')?.value || ('Localidad ' + (index + 1)) }}</strong>
                              @if (section.get('code')?.value) {
                                <span class="code-pill">{{ section.get('code')?.value }}</span>
                              }
                            </div>
                          </div>
                          <span class="map-locked-indicator"><mat-icon>lock</mat-icon> Mapa protegido</span>
                        </div>

                        <div class="section-pricing-grid">
                          <mat-form-field appearance="outline">
                            <mat-label>Precio de la localidad*</mat-label>
                            <span matTextPrefix>Q&nbsp;</span>
                            <input matInput type="number" min="0" formControlName="price" placeholder="100" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Fee servicio</mat-label>
                            <span matTextPrefix>Q&nbsp;</span>
                            <input matInput type="number" min="0" formControlName="serviceFee" placeholder="0" />
                          </mat-form-field>
                        </div>
                      </div>
                    } @empty {
                      <p class="step-note warning"><mat-icon>warning</mat-icon> No hay localidades registradas para este evento.</p>
                    }
                  </div>
                } @else {
                  @if (form.controls.venueMode.value === 'existing') {
                    <p class="step-note"><mat-icon>check_circle</mat-icon> {{ sectionControls.length }} secciones cargadas desde el venue existente.</p>
                  } @else {
                    <p class="step-note"><mat-icon>auto_awesome</mat-icon> Configura las filas y mesas por fila para autogenerar el plano de mesas y localidades.</p>
                  }
                  <div formArrayName="sections" class="section-editor">
                    @for (section of sectionControls; track section; let index = $index) {
                      <div class="section-card" [formGroupName]="index">
                        <div class="section-card-top">
                          <span class="section-badge">{{ index + 1 }}</span>
                          <mat-form-field appearance="outline" class="field-name">
                            <mat-label>Sección*</mat-label>
                            <input matInput formControlName="name" placeholder="general" />
                          </mat-form-field>
                          <mat-form-field appearance="outline" class="field-code">
                            <mat-label>Código</mat-label>
                            <input matInput formControlName="code" placeholder="G" />
                          </mat-form-field>
                          <button class="delete-section" mat-icon-button type="button" aria-label="Eliminar sección" matTooltip="Eliminar sección" (click)="removeSection(index)">
                            <mat-icon>delete_outline</mat-icon>
                          </button>
                        </div>

                        <div class="section-card-bottom">
                          <mat-form-field appearance="outline">
                            <mat-label>Filas*</mat-label>
                            <input matInput formControlName="rows" placeholder="A o 5" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Mesas por fila*</mat-label>
                            <input matInput type="number" min="1" formControlName="seatsPerRow" placeholder="20" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Precio*</mat-label>
                            <span matTextPrefix>Q&nbsp;</span>
                            <input matInput type="number" min="0" formControlName="price" placeholder="100" />
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Fee servicio</mat-label>
                            <span matTextPrefix>Q&nbsp;</span>
                            <input matInput type="number" min="0" formControlName="serviceFee" placeholder="0" />
                          </mat-form-field>
                        </div>
                      </div>
                    } @empty {
                      <p class="step-note warning"><mat-icon>warning</mat-icon> No hay secciones agregadas.</p>
                    }
                  </div>
                  <button class="btn-add-section" mat-stroked-button type="button" (click)="addSection()">
                    <mat-icon>add</mat-icon> Agregar sección
                  </button>
                }
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
                <button mat-icon-button type="button" matTooltip="Archivar y conservar ventas" (click)="archiveEvent(event)">
                  <mat-icon>archive</mat-icon>
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
    .section-card-top {
      display: grid; grid-template-columns: 28px 1fr 120px 40px; gap: 10px; align-items: center;
    }
    .section-card-top .field-name { min-width: 0; }
    .section-card-top .field-code { min-width: 0; }
    .section-badge {
      display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
      background: #e8f1ff; color: #0759b8; font-size: .82rem; font-weight: 800;
    }
    .delete-section { color: #ef4444; }
    .section-card-bottom {
      display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; align-items: center;
    }
    .btn-add-section {
      width: 100%; border-style: dashed !important; border-radius: 12px !important;
      padding: 10px !important; color: #0284c7 !important; border-color: #7dd3fc !important;
      display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 600;
    }
    .btn-add-section:hover {
      background: #f0f9ff !important;
    }
    @media (max-width: 650px) {
      .section-card-top { grid-template-columns: 28px 1fr 40px; }
      .section-card-top .field-code { grid-column: 1 / -1; }
      .section-card-bottom { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 440px) {
      .section-card-bottom { grid-template-columns: 1fr; }
    }

    .venue-locked-card {
      padding: 16px;
      border: 1px solid #c7d2fe;
      border-radius: 14px;
      background: #f5f7ff;
      display: grid;
      gap: 10px;
    }
    .venue-locked-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .venue-icon {
      color: #4f46e5;
      font-size: 26px;
      width: 26px;
      height: 26px;
    }
    .venue-locked-details {
      flex: 1;
      min-width: 0;
    }
    .venue-locked-details strong {
      display: block;
      font-size: 0.98rem;
      color: #1e1b4b;
    }
    .venue-locked-details p {
      margin: 2px 0 0;
      color: #4338ca;
      font-size: 0.82rem;
    }
    .locked-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #e0e7ff;
      color: #3730a3;
      font-size: 0.76rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .locked-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .edit-mode-card {
      border-left: 4px solid #3b82f6;
    }
    .section-edit-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .section-identity {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .section-title-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .section-name {
      font-size: 1rem;
      color: #0f172a;
      font-weight: 700;
    }
    .code-pill {
      display: inline-block;
      padding: 2px 8px;
      background: #e2e8f0;
      color: #334155;
      border-radius: 6px;
      font-size: 0.74rem;
      font-weight: 700;
      font-family: monospace;
    }
    .map-locked-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.76rem;
      font-weight: 600;
      color: #059669;
      background: #ecfdf5;
      padding: 3px 8px;
      border-radius: 999px;
    }
    .map-locked-indicator mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .section-pricing-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      align-items: center;
    }
    @media (max-width: 600px) {
      .section-pricing-grid {
        grid-template-columns: 1fr;
      }
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
  private readonly notifications = inject(NotificationService);

  readonly events$: Observable<EventItem[]> = this.events.events$.pipe(map((events) => events.filter((event) => !event.archived)));
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
    venueName: [''],
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
    if (this.editingEvent) return true;
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
      if (!this.editingEvent && this.form.controls.venueMode.value === 'existing' && !this.form.controls.venueId.value && venues.length > 0) {
        this.form.patchValue({ venueId: venues[0].id.toString() });
        this.onVenueSelectionChange();
      } else if (this.editingEvent && !this.form.controls.venueId.value) {
        const matchedVenueId = this.editingEvent.venueId ? String(this.editingEvent.venueId) : this.findVenueIdByName(this.editingEvent.venueName);
        if (matchedVenueId) {
          this.form.patchValue({ venueId: matchedVenueId });
        }
      }
    });
  }

  saveEvent(): void {
    if (this.form.controls.venueMode.value === 'new') {
      const newName = this.form.controls.newVenueName.value.trim();
      const newAddr = this.form.controls.newVenueAddress.value.trim();
      const newCity = this.form.controls.newVenueCity.value.trim();
      this.form.patchValue({
        venueName: newName,
        location: this.form.controls.location.value.trim() || newName,
        address: this.form.controls.address.value.trim() || newAddr,
        city: this.form.controls.city.value.trim() || newCity || 'Guatemala City'
      });
    }

    if (this.courtesyLimit && this.form.controls.courtesyLimit.value < this.courtesyLimit.used) {
      this.form.controls.courtesyLimit.setErrors({ belowUsed: true });
    }
    if (this.form.invalid || !this.venueStepValid || !this.sectionsStepValid || (!this.editingEvent && !this.selectedImage)) {
      this.form.markAllAsTouched();
      if (!this.venueStepValid) {
        this.notifications.warning('Por favor completa todos los datos obligatorios del venue / ubicación.');
      } else if (!this.sectionsStepValid) {
        this.notifications.warning('Configura al menos una sección válida con sus mesas.');
      } else if (!this.editingEvent && !this.selectedImage) {
        this.notifications.warning('Debes seleccionar una imagen para el evento.');
      } else {
        this.notifications.warning('Por favor completa los campos requeridos del evento.');
      }
      return;
    }

    this.saving = true;
    const request$ = this.editingEvent
      ? this.events.updateEvent(this.editingEvent.id, this.toAdminInput())
      : this.createCompleteEvent();

    request$.pipe(
      switchMap((event) => this.courtesyLimitsService.save(event.id, this.form.controls.courtesyLimit.value, this.courtesyLimit?.id).pipe(map(() => event))),
      finalize(() => this.saving = false)
    ).subscribe({
      next: () => {
        this.notifications.success(
          this.editingEvent
            ? 'Evento actualizado correctamente.'
            : (this.form.controls.venueMode.value === 'new'
                ? 'Venue y evento creados exitosamente.'
                : 'Evento creado exitosamente.')
        );
        this.resetForm();
      },
      error: (error) => {
        console.error('Error al guardar evento:', error);
        const message = error?.error?.message || error?.message || 'Error al procesar la creación del evento o recinto.';
        this.notifications.error(message);
      }
    });
  }

  editEvent(event: EventItem): void {
    this.editingEvent = event;
    this.courtesyLimit = null;
    this.form.controls.courtesyLimit.setValue(0);
    this.loadCourtesyLimit(event.id, true);
    this.selectedImage = null;
    this.imagePreview = event.image;
    const localDate = this.events.getEventLocalParts(event.date);
    const matchedVenueId = event.venueId ? String(event.venueId) : this.findVenueIdByName(event.venueName);
    this.form.patchValue({
      venueMode: 'existing',
      name: event.name,
      category: event.category,
      city: event.city,
      date: localDate.date,
      time: localDate.time,
      location: event.location,
      venueId: matchedVenueId,
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

    // Cargar inmediatamente las localidades existentes para edición directa de precio y fee
    this.form.controls.sections.clear();
    if (event.priceTiers && event.priceTiers.length > 0) {
      event.priceTiers.forEach((tier) => {
        this.form.controls.sections.push(this.fb.group({
          id: [tier.sectionId ? String(tier.sectionId) : ''],
          name: [tier.name, Validators.required],
          code: [tier.name.slice(0, 4).toUpperCase()],
          rows: ['A', Validators.required],
          seatsPerRow: [1, [Validators.required, Validators.min(1)]],
          price: [tier.price, [Validators.required, Validators.min(0)]],
          serviceFee: [tier.serviceFee ?? 0, [Validators.required, Validators.min(0)]]
        }));
      });
    }

    if (matchedVenueId) {
      this.loadVenueSections(matchedVenueId);
    }
  }

  publishEvent(event: EventItem): void {
    this.events.publishEvent(event.id).subscribe();
  }

  archiveEvent(event: EventItem): void {
    this.events.archiveEvent(event.id).subscribe(() => {
      this.notifications.success('Evento archivado. Puedes consultar sus ventas en Eventos anteriores.');
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
      const currentNewName = this.form.controls.newVenueName.value.trim();
      const currentNewAddr = this.form.controls.newVenueAddress.value.trim();
      const currentNewCity = this.form.controls.newVenueCity.value.trim() || 'Guatemala City';
      this.form.patchValue({
        venueId: '',
        venueName: currentNewName,
        location: currentNewName,
        address: currentNewAddr,
        city: currentNewCity
      });
      this.addSection();
      return;
    }
    if (this.venues.length > 0) {
      this.form.controls.venueId.setValue(String(this.venues[0].id));
      this.onVenueSelectionChange();
    }
  }

  onVenueStepNext(): void {
    if (this.form.controls.venueMode.value === 'new') {
      const newName = this.form.controls.newVenueName.value.trim();
      const newAddr = this.form.controls.newVenueAddress.value.trim();
      const newCity = this.form.controls.newVenueCity.value.trim();
      this.form.patchValue({
        venueName: newName,
        location: this.form.controls.location.value.trim() || newName,
        address: this.form.controls.address.value.trim() || newAddr,
        city: this.form.controls.city.value.trim() || newCity || 'Guatemala City'
      });
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
      (sum, sec) => {
        const rowCount = this.parseRowCount(sec.rows);
        const tablesPerRow = Math.max(1, Number(sec.seatsPerRow) || 20);
        return sum + (rowCount * tablesPerRow * 10);
      },
      0
    );

    const resolvedVenueId = this.editingEvent
      ? (this.editingEvent.venueId ? String(this.editingEvent.venueId) : (raw.venueId || this.findVenueIdByName(this.editingEvent.venueName)))
      : raw.venueId;

    const resolvedCapacity = this.editingEvent
      ? (this.editingEvent.metrics?.ticketsLeft || raw.capacity || calculatedCapacity || 100)
      : (raw.capacity && raw.capacity > 0 ? raw.capacity : (calculatedCapacity || 100));

    return {
      ...raw,
      venueId: resolvedVenueId,
      venueName: this.editingEvent?.venueName || raw.venueName,
      location: this.editingEvent?.location || raw.location,
      address: this.editingEvent?.address || raw.address,
      city: this.editingEvent?.city || raw.city,
      capacity: resolvedCapacity,
      imageFile: this.selectedImage,
      tags: this.parseTags(raw.tagsText),
      priceTiers: raw.sections.map((section) => ({
        sectionId: section.id ? (Number(section.id) || section.id) : undefined,
        name: section.name,
        price: Number(section.price),
        serviceFee: Number(section.serviceFee || 0),
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
        if (!this.venues.some((v) => String(v.id) === String(venue.id))) {
          this.venues = [venue, ...this.venues];
        }

        this.form.patchValue({
          venueId: String(venue.id),
          venueName: venue.name,
          location: venue.name,
          city: venue.city,
          address: venue.address
        });

        // Crear las localidades antes de guardar el plano con sus identificadores reales.
        return of(null).pipe(
          switchMap(() => from(raw.sections).pipe(
            concatMap((section, index) => {
              const baseCode = (section.code?.trim() || section.name.trim().slice(0, 4) || 'SEC')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '');
              const uniqueCode = `V${venue.id}_${baseCode || 'SEC'}_${index + 1}`.slice(0, 48);

              return this.venueService.createSection({
                venue_id: Number(venue.id),
                name: section.name.trim(),
                code: uniqueCode
              }).pipe(
                catchError((err) => {
                  console.error('Error al crear sección:', err);
                  return of({ id: Math.floor(Math.random() * 1000), name: section.name, code: uniqueCode });
                }),
                map((created) => ({ created, source: section }))
              );
            }),
            toArray()
          )),
          switchMap((sections) => {
            const sectionIds = new Map(sections.map(({ created }, index) => [
              `sec-${index + 1}`, String(created.id)
            ]));
            const remapSection = (value: unknown): unknown => {
              const record = value as Record<string, unknown>;
              const sectionId = sectionIds.get(String(record['sectionId'] ?? ''));
              return sectionId ? { ...record, sectionId } : record;
            };
            const persistedMap = {
              ...seatMapConfig,
              sections: seatMapConfig.sections.map((value) => {
                const section = value as Record<string, unknown>;
                return { ...section, id: sectionIds.get(String(section['id'])) ?? section['id'] };
              }),
              tables: seatMapConfig.tables.map(remapSection),
              elements: seatMapConfig.elements.map(remapSection)
            };
            return this.venueService.saveSeatMap(venue.id, persistedMap).pipe(
              map(() => sections)
            );
          }),
          // 3. Generar asientos en backend para cada sección
          switchMap((sections) => from(sections).pipe(
            concatMap(({ created, source }) => {
              const rowCount = this.parseRowCount(source.rows);
              const rowLetters = this.parseRowLabels(source.rows, rowCount).join(',');
              const tablesPerRow = Math.max(1, Number(source.seatsPerRow) || 20);
              const seatsPerRow = tablesPerRow * 10;

              return this.venueService.generateSeats({
                section_id: Number(created.id),
                rows: rowLetters,
                seats_per_row: seatsPerRow
              }).pipe(catchError((err) => {
                console.error('Error al generar asientos:', err);
                return of(null);
              }));
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
    rows: string;
    seatsPerRow: number;
    price: number;
    serviceFee?: number;
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
      { id: 'stage', kind: 'stage', label: 'ESCENARIO', x: 460, y: 20, w: 980, h: 90, color: '#142238', textColor: '#fff7ed', rotation: 0 }
    ];

    const mappedSections: unknown[] = [];
    const tables: unknown[] = [];
    let globalTableNumber = 1;
    let globalRowNumber = 1;
    let currentY = 170;

    rawSections.forEach((sec, sIdx) => {
      const sectionId = `sec-${sIdx + 1}`;
      const secColor = sectionColors[sIdx % sectionColors.length];
      const zoneBg = zoneBgColors[sIdx % zoneBgColors.length];
      const rowCount = this.parseRowCount(sec.rows);
      const tablesPerRow = Math.max(1, Number(sec.seatsPerRow) || 20);
      const totalTablesInSec = rowCount * tablesPerRow;
      const sectionStartY = currentY;
      const sectionHeight = rowCount * 145 + 30;

      mappedSections.push({
        id: sectionId,
        name: sec.name,
        price: Number(sec.price) || 150,
        color: secColor,
        tableCount: totalTablesInSec
      });

      elements.push({
        id: `zone-${sectionId}`,
        sectionId,
        kind: 'zone',
        label: sec.name.toUpperCase(),
        x: 95,
        y: sectionStartY - 55,
        w: 1735,
        h: sectionHeight,
        color: zoneBg,
        textColor: '#0f172a',
        rotation: 0
      });

      for (let r = 0; r < rowCount; r++) {
        const rowCenterY = sectionStartY + r * 145;
        const spacingX = tablesPerRow > 1 ? Math.min(84, 1600 / (tablesPerRow - 1)) : 84;

        for (let col = 0; col < tablesPerRow; col++) {
          const centerX = 150 + col * spacingX;
          const tableX = centerX - TABLE_W / 2;
          const tableY = rowCenterY - TABLE_H / 2;

          const seats: Array<{ number: number; x: number; y: number }> = [];
          for (let s = 1; s <= 10; s++) {
            const onLeft = s <= 5;
            const sideIndex = onLeft ? s - 1 : s - 6;
            const cx = onLeft ? tableX - SEAT_OFFSET : tableX + TABLE_W + SEAT_OFFSET;
            const cy = tableY + 7 + sideIndex * 16;
            seats.push({ number: s, x: Math.round(cx), y: Math.round(cy) });
          }

          tables.push({
            id: `table-${globalTableNumber}`,
            label: String(globalTableNumber),
            section: sec.name,
            sectionId,
            x: Math.round(tableX),
            y: Math.round(tableY),
            rotation: 0,
            isRowStart: col === 0,
            rowNumber: globalRowNumber,
            seats
          });

          globalTableNumber++;
        }

        globalRowNumber++;
      }

      currentY = sectionStartY + sectionHeight + 40;
    });

    elements.push({
      id: 'foh-zone',
      kind: 'zone',
      label: 'FOH (FRONT OF HOUSE)',
      x: 830,
      y: currentY + 30,
      w: 240,
      h: 80,
      color: '#e2e8f0',
      textColor: '#0f172a',
      rotation: 0
    });

    const canvasHeight = Math.max(2120, currentY + 180);
    const totalTables = tables.length;
    const totalSeats = totalTables * 10;

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
      || (section?.name ? section.name.trim().slice(0, 4).toUpperCase() : '');

    const tier = this.editingEvent
      ? this.editingEvent.priceTiers.find((t) =>
          String(t.sectionId ?? '') === String(section?.id ?? '')
          || t.name.trim().toLowerCase() === (section?.name ?? '').trim().toLowerCase()
        )
      : undefined;

    return this.fb.group({
      id: [section ? String(section.id) : ''],
      name: [section?.name ?? '', Validators.required],
      code: [defaultCode],
      rows: ['A' as string, Validators.required],
      seatsPerRow: [1, [Validators.required, Validators.min(1)]],
      price: [tier?.price ?? this.editingEvent?.basePrice ?? 150, [Validators.required, Validators.min(0)]],
      serviceFee: [tier?.serviceFee ?? 0, [Validators.required, Validators.min(0)]]
    });
  }

  parseRowCount(rowsInput: string | number | null | undefined): number {
    if (rowsInput === null || rowsInput === undefined) return 1;
    const val = String(rowsInput).trim();
    if (!val) return 1;

    if (/^\d+$/.test(val)) {
      return Math.max(1, parseInt(val, 10));
    }

    const letterRangeMatch = val.match(/^([A-Za-z])\s*-\s*([A-Za-z])$/);
    if (letterRangeMatch) {
      const start = letterRangeMatch[1].toUpperCase().charCodeAt(0);
      const end = letterRangeMatch[2].toUpperCase().charCodeAt(0);
      if (end >= start) return end - start + 1;
    }

    const numRangeMatch = val.match(/^(\d+)\s*-\s*(\d+)$/);
    if (numRangeMatch) {
      const start = parseInt(numRangeMatch[1], 10);
      const end = parseInt(numRangeMatch[2], 10);
      if (end >= start) return end - start + 1;
    }

    if (val.includes(',')) {
      const parts = val.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts.length;
    }

    return 1;
  }

  parseRowLabels(rowsInput: string | number | null | undefined, count: number): string[] {
    if (rowsInput === null || rowsInput === undefined) {
      return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + (i % 26)));
    }
    const val = String(rowsInput).trim();
    if (/^\d+$/.test(val)) {
      const n = Math.max(1, parseInt(val, 10));
      return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + (i % 26)));
    }
    const letterRangeMatch = val.match(/^([A-Za-z])\s*-\s*([A-Za-z])$/);
    if (letterRangeMatch) {
      const start = letterRangeMatch[1].toUpperCase().charCodeAt(0);
      const end = letterRangeMatch[2].toUpperCase().charCodeAt(0);
      if (end >= start) {
        const labels: string[] = [];
        for (let code = start; code <= end; code++) labels.push(String.fromCharCode(code));
        return labels;
      }
    }
    if (val.includes(',')) {
      const parts = val.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) return parts;
    }
    if (count > 1) {
      return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + (i % 26)));
    }
    return [val.toUpperCase() || 'A'];
  }

  private loadVenueSections(venueId: number | string): void {
    this.venueService.getVenueSections(venueId).subscribe({
      next: (sections) => {
        if (this.form.controls.venueMode.value !== 'existing'
          || String(this.form.controls.venueId.value) !== String(venueId)) return;

        if (this.editingEvent) {
          // Mantener sincronizadas las secciones del venue sin alterar su estructura
          // conservando los precios y fees definidos en el evento
          if (sections.length > 0) {
            const currentControls = this.form.controls.sections.controls;
            const priceMap = new Map<string, { price: number; serviceFee: number }>();

            currentControls.forEach((group) => {
              const name = (group.get('name')?.value || '').trim().toLowerCase();
              const id = group.get('id')?.value;
              const val = {
                price: Number(group.get('price')?.value) || 0,
                serviceFee: Number(group.get('serviceFee')?.value) || 0
              };
              if (name) priceMap.set(name, val);
              if (id) priceMap.set(String(id), val);
            });

            this.editingEvent.priceTiers.forEach((tier) => {
              const name = tier.name.trim().toLowerCase();
              const id = tier.sectionId ? String(tier.sectionId) : undefined;
              const val = {
                price: Number(tier.price) || 0,
                serviceFee: Number(tier.serviceFee) || 0
              };
              if (!priceMap.has(name)) priceMap.set(name, val);
              if (id && !priceMap.has(id)) priceMap.set(id, val);
            });

            this.form.controls.sections.clear();
            sections.forEach((sec) => {
              const match = priceMap.get(String(sec.id)) ?? priceMap.get(sec.name.trim().toLowerCase());
              this.form.controls.sections.push(this.fb.group({
                id: [String(sec.id)],
                name: [sec.name, Validators.required],
                code: [sec.code || sec.name.slice(0, 4).toUpperCase()],
                rows: ['A', Validators.required],
                seatsPerRow: [1, [Validators.required, Validators.min(1)]],
                price: [match?.price ?? this.editingEvent?.basePrice ?? 150, [Validators.required, Validators.min(0)]],
                serviceFee: [match?.serviceFee ?? 0, [Validators.required, Validators.min(0)]]
              }));
            });
            return;
          }
        }

        this.form.controls.sections.clear();
        sections.forEach((section) => this.addSection(section));
      },
      error: (err) => {
        console.warn('No se pudieron cargar secciones del venue:', err);
      }
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
    const normalized = (venueName || '').trim().toLowerCase();
    return this.venues.find((venue) => venue.name.trim().toLowerCase() === normalized)?.id.toString() ?? '';
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

